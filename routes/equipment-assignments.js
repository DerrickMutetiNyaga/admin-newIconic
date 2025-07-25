const express = require('express');
const router = express.Router();
const Equipment = require('../models/Equipment');
const EquipmentAssignment = require('../models/EquipmentAssignment');
const XLSX = require('xlsx');

// Get all assignments
router.get('/assignments', async (req, res) => {
    try {
        const assignments = await EquipmentAssignment.find()
            .populate({ path: 'equipmentId', select: 'equipmentName macAddress', model: 'Equipment' })
            .sort({ createdAt: -1 })
            .lean();
        
        if (!Array.isArray(assignments)) {
            throw new Error('Invalid assignments data format');
        }
        
        // Map equipmentId to equipment for frontend compatibility
        const mapped = assignments.map(a => ({
            ...a,
            equipment: a.equipmentId,
            equipmentId: a.equipmentId ? (typeof a.equipmentId === 'object' ? a.equipmentId._id : a.equipmentId) : null
        }));
        
        res.json({ 
            success: true, 
            data: mapped,
            totalCount: mapped.length
        });
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ message: 'Error fetching assignments' });
    }
});

// Get unassigned equipment
router.get('/unassigned', async (req, res) => {
    try {
        const unassignedEquipment = await Equipment.find({ status: 'In Stock' });
        res.json(unassignedEquipment);
    } catch (error) {
        console.error('Error fetching unassigned equipment:', error);
        res.status(500).json({ message: 'Error fetching unassigned equipment' });
    }
});

// Create new assignment
router.post('/assign', async (req, res) => {
    try {
        const { equipmentId, assigneeName, stationName, assignmentType } = req.body;

        // Validate required fields
        if (!equipmentId || !assigneeName || !stationName || !assignmentType) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if equipment exists and is available
        const equipment = await Equipment.findById(equipmentId);
        if (!equipment) {
            return res.status(404).json({ message: 'Equipment not found' });
        }
        if (equipment.status !== 'In Stock') {
            return res.status(400).json({ message: 'Equipment is not available for assignment' });
        }

        // Create assignment
        const assignment = new EquipmentAssignment({
            equipmentId,
            assigneeName,
            stationName,
            assignmentType
        });

        await assignment.save();

        // Update equipment status
        equipment.status = 'Assigned';
        await equipment.save();

        res.status(201).json(assignment);
    } catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ message: 'Error creating assignment' });
    }
});

// Get single assignment
router.get('/assignments/:id', async (req, res) => {
    try {
        const assignment = await EquipmentAssignment.findById(req.params.id)
            .populate({ path: 'equipmentId', select: 'equipmentName macAddress', model: 'Equipment' })
            .lean();
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }
        // Always include equipmentId as string
        if (assignment.equipmentId && typeof assignment.equipmentId === 'object' && assignment.equipmentId._id) {
            assignment.equipment = assignment.equipmentId;
            assignment.equipmentId = assignment.equipmentId._id.toString();
        }
        res.json(assignment);
    } catch (error) {
        console.error('Error fetching assignment:', error);
        res.status(500).json({ message: 'Error fetching assignment' });
    }
});

// Delete assignment
router.delete('/assignments/:id', async (req, res) => {
    try {
        const assignment = await EquipmentAssignment.findById(req.params.id);
        
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        // Update equipment status back to In Stock
        const equipment = await Equipment.findById(assignment.equipmentId);
        if (equipment) {
            equipment.status = 'In Stock';
            await equipment.save();
        }

        await EquipmentAssignment.deleteOne({ _id: req.params.id });
        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        console.error('Error deleting assignment:', error);
        res.status(500).json({ message: 'Error deleting assignment' });
    }
});

// Export assignments to Excel
router.get('/export', async (req, res) => {
    try {
        const { search, station } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { assigneeName: { $regex: search, $options: 'i' } },
                { stationName: { $regex: search, $options: 'i' } },
                { assignmentType: { $regex: search, $options: 'i' } }
            ];
        }
        if (station) {
            query.stationName = { $regex: station, $options: 'i' };
        }

        const assignments = await EquipmentAssignment.find(query)
            .populate({ path: 'equipmentId', select: 'equipmentName macAddress', model: 'Equipment' })
            .sort({ createdAt: -1 })
            .lean();

        // Prepare data for Excel
        const excelData = assignments.map(a => ({
            'Equipment Name': a.equipmentId?.equipmentName || '',
            'MAC Address': a.equipmentId?.macAddress || '',
            'Assignee': a.assigneeName,
            'Station': a.stationName,
            'Type': a.assignmentType,
            'Created At': a.createdAt ? new Date(a.createdAt).toLocaleString() : '',
            'Updated At': a.updatedAt ? new Date(a.updatedAt).toLocaleString() : ''
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Assignments');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=equipment-assignments.xlsx');
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error exporting assignments:', error);
        res.status(500).json({ error: 'Failed to export assignments' });
    }
});

// Update assignment
router.put('/assignments/:id', async (req, res) => {
    try {
        const { equipmentId, assigneeName, stationName, assignmentType } = req.body;
        // Validate required fields
        if (!equipmentId || !assigneeName || !stationName || !assignmentType) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        // Find the existing assignment
        const assignment = await EquipmentAssignment.findById(req.params.id);
        if (!assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }
        // If equipment changed, update statuses
        if (assignment.equipmentId.toString() !== equipmentId) {
            // Set old equipment to In Stock
            const oldEquipment = await Equipment.findById(assignment.equipmentId);
            if (oldEquipment) {
                oldEquipment.status = 'In Stock';
                await oldEquipment.save();
            }
            // Set new equipment to Assigned
            const newEquipment = await Equipment.findById(equipmentId);
            if (newEquipment) {
                newEquipment.status = 'Assigned';
                await newEquipment.save();
            }
        }
        // Update assignment fields
        assignment.equipmentId = equipmentId;
        assignment.assigneeName = assigneeName;
        assignment.stationName = stationName;
        assignment.assignmentType = assignmentType;
        await assignment.save();
        res.json(assignment);
    } catch (error) {
        console.error('Error updating assignment:', error);
        res.status(500).json({ message: 'Error updating assignment' });
    }
});

module.exports = router; 