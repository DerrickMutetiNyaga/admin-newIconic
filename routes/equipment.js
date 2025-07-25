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

// Error handler
const errorHandler = (error, res) => {
    console.error(error);
    const statusCode = error.statusCode || 500;
    const errorResponse = {
        success: false,
        error: error.userMessage || 'An error occurred',
        details: error.message
    };
    if (error.code === 11000) {
        errorResponse.error = 'Duplicate MAC address';
        errorResponse.details = 'An equipment with this MAC address already exists';
    }
    res.status(statusCode).json(errorResponse);
};

// Async handler
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(error => errorHandler(error, res));
};

// Get all equipment
router.get('/', requireAuth, asyncHandler(async (req, res) => {
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
    const equipment = await Equipment.find(query).sort({ createdAt: -1 }).lean();
    if (!Array.isArray(equipment)) {
        throw Object.assign(new Error('Invalid equipment data format'), {
            statusCode: 500,
            userMessage: 'Failed to retrieve equipment data'
        });
    }
    res.json({ success: true, data: equipment });
}));

// Create new equipment
router.post('/', requireAuth, asyncHandler(async (req, res) => {
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
}));

// Update equipment
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
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
}));

// Delete equipment
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const equipment = await Equipment.findByIdAndDelete(req.params.id);

    if (!equipment) {
        return res.status(404).json({ message: 'Equipment not found' });
    }

    res.json({ message: 'Equipment deleted successfully' });
}));

// Export equipment endpoint
router.get('/export', requireAuth, asyncHandler(async (req, res) => {
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
}));

// Get single equipment by ID
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
        return res.status(404).json({ message: 'Equipment not found' });
    }
    res.json(equipment);
}));

module.exports = router;