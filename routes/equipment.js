const express = require('express');
const router = express.Router();
const Equipment = require('../models/Equipment');
const XLSX = require('xlsx');

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Get all equipment
router.get('/', requireAuth, async (req, res) => {
    try {
        const { equipmentName, search } = req.query;
        let query = {};
        if (equipmentName) query.equipmentName = equipmentName;
        if (search) {
            query.$or = [
                { equipmentName: { $regex: search, $options: 'i' } },
                { modelName: { $regex: search, $options: 'i' } },
                { macAddress: { $regex: search, $options: 'i' } }
            ];
        }
        const equipment = await Equipment.find(query).sort({ createdAt: -1 });
        res.json(equipment);
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ message: 'Error fetching equipment' });
    }
});

// Create new equipment
router.post('/', requireAuth, async (req, res) => {
    try {
        const { equipmentName, modelName, macAddress, purchaseDate, status } = req.body;
        
        // Validate required fields
        if (!equipmentName || !modelName || !macAddress || !status) {
            return res.status(400).json({ message: 'All required fields must be filled' });
        }

        // Normalize MAC address
        const normalizedMac = macAddress.replace(/[:-]/g, '').toUpperCase();
        const formattedMac = normalizedMac.match(/.{1,2}/g).join(':');

        // Check if MAC address already exists
        const existingEquipment = await Equipment.findOne({ 
            macAddress: { $regex: new RegExp(normalizedMac, 'i') }
        });
        
        if (existingEquipment) {
            return res.status(400).json({ 
                message: 'Equipment with this MAC address already exists',
                details: `MAC Address ${formattedMac} is already registered to ${existingEquipment.equipmentName}`
            });
        }

        // Create new equipment
        const equipment = new Equipment({
            equipmentName,
            modelName,
            macAddress: formattedMac,
            purchaseDate: purchaseDate || null,
            status
        });

        await equipment.save();
        res.status(201).json(equipment);
    } catch (error) {
        console.error('Error creating equipment:', error);
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: 'Equipment with this MAC address already exists',
                details: 'Please use a different MAC address'
            });
        }
        res.status(500).json({ 
            message: 'Error creating equipment', 
            error: error.message 
        });
    }
});

// Update equipment
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { equipmentName, modelName, macAddress, purchaseDate, status } = req.body;
        
        // Validate required fields
        if (!equipmentName || !modelName || !macAddress || !status) {
            return res.status(400).json({ message: 'All required fields must be filled' });
        }

        // Normalize MAC address
        const normalizedMac = macAddress.replace(/[:-]/g, '').toUpperCase();
        const formattedMac = normalizedMac.match(/.{1,2}/g).join(':');

        // Check if MAC address already exists on a different equipment
        const existingEquipment = await Equipment.findOne({ 
            macAddress: { $regex: new RegExp(normalizedMac, 'i') },
            _id: { $ne: req.params.id }
        });
        
        if (existingEquipment) {
            return res.status(400).json({ 
                message: 'Equipment with this MAC address already exists',
                details: `MAC Address ${formattedMac} is already registered to ${existingEquipment.equipmentName}`
            });
        }

        const equipment = await Equipment.findByIdAndUpdate(
            req.params.id,
            { 
                equipmentName, 
                modelName,
                macAddress: formattedMac,
                purchaseDate: purchaseDate || null,
                status,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!equipment) {
            return res.status(404).json({ message: 'Equipment not found' });
        }

        res.json(equipment);
    } catch (error) {
        console.error('Error updating equipment:', error);
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: 'Equipment with this MAC address already exists',
                details: 'Please use a different MAC address'
            });
        }
        res.status(500).json({ 
            message: 'Error updating equipment', 
            error: error.message 
        });
    }
});

// Delete equipment
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const equipment = await Equipment.findByIdAndDelete(req.params.id);

        if (!equipment) {
            return res.status(404).json({ message: 'Equipment not found' });
        }

        res.json({ message: 'Equipment deleted successfully' });
    } catch (error) {
        console.error('Error deleting equipment:', error);
        res.status(500).json({ message: 'Error deleting equipment' });
    }
});

// Export equipment endpoint
router.get('/export', requireAuth, async (req, res) => {
    try {
        const { equipmentName, search } = req.query;
        let query = {};
        if (equipmentName) query.equipmentName = equipmentName;
        if (search) {
            query.$or = [
                { equipmentName: { $regex: search, $options: 'i' } },
                { modelName: { $regex: search, $options: 'i' } },
                { macAddress: { $regex: search, $options: 'i' } }
            ];
        }
        const equipment = await Equipment.find(query).sort({ createdAt: -1 });
        const excelData = equipment.map(eq => ({
            'Equipment Name': eq.equipmentName,
            'Model Name': eq.modelName,
            'MAC Address': eq.macAddress,
            'Purchase Date': eq.purchaseDate ? new Date(eq.purchaseDate).toLocaleDateString() : '',
            'Status': eq.status,
            'Created At': eq.createdAt ? new Date(eq.createdAt).toLocaleDateString() : '',
            'Updated At': eq.updatedAt ? new Date(eq.updatedAt).toLocaleDateString() : ''
        }));
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Equipment');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=equipment.xlsx');
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error exporting equipment:', error);
        res.status(500).json({ error: 'Failed to export equipment' });
    }
});

// Get single equipment by ID
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const equipment = await Equipment.findById(req.params.id);
        if (!equipment) {
            return res.status(404).json({ message: 'Equipment not found' });
        }
        res.json(equipment);
    } catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ message: 'Error fetching equipment' });
    }
});

module.exports = router; 