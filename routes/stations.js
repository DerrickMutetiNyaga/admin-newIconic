const express = require('express');
const router = express.Router();
const Station = require('../models/Station');

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Add a new station
router.post('/', requireAuth, async (req, res) => {
    try {
        const { name, location, description, isActive } = req.body;
        const createdBy = req.body.createdBy || req.session.userId;
        if (!name) {
            return res.status(400).json({ message: 'Station name is required' });
        }
        // Check for duplicate
        const existing = await Station.findOne({ name });
        if (existing) {
            return res.status(400).json({ message: 'Station already exists' });
        }
        const station = new Station({
            name,
            location,
            description,
            isActive: typeof isActive === 'boolean' ? isActive : true,
            createdBy
        });
        await station.save();
        res.status(201).json(station);
    } catch (error) {
        console.error('Error adding station:', error);
        res.status(500).json({ message: 'Error adding station' });
    }
});

// Get all stations
router.get('/', requireAuth, async (req, res) => {
    try {
        const stations = await Station.find().sort({ name: 1 });
        res.json(stations);
    } catch (error) {
        console.error('Error fetching stations:', error);
        res.status(500).json({ message: 'Error fetching stations' });
    }
});

// Update a station
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { name, location, description, isActive } = req.body;
        const update = { name, location, description, isActive };
        // Remove undefined fields
        Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);
        const station = await Station.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        );
        if (!station) {
            return res.status(404).json({ message: 'Station not found' });
        }
        res.json(station);
    } catch (error) {
        console.error('Error updating station:', error);
        res.status(500).json({ message: 'Error updating station' });
    }
});

// Delete a station
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const station = await Station.findByIdAndDelete(req.params.id);
        if (!station) {
            return res.status(404).json({ message: 'Station not found' });
        }
        res.json({ message: 'Station deleted successfully' });
    } catch (error) {
        console.error('Error deleting station:', error);
        res.status(500).json({ message: 'Error deleting station' });
    }
});

module.exports = router; 