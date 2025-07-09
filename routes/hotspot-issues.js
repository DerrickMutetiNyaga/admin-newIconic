const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Create a schema for hotspot issues
const hotspotIssueSchema = new mongoose.Schema({
    clientNumber: { type: String, required: true },
    station: { type: String, required: true },
    problemDescription: { type: String, required: true },
    dateLogged: { type: Date, default: Date.now },
    status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open' },
    loggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const HotspotIssue = mongoose.model('HotspotIssue', hotspotIssueSchema);

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Create a new hotspot issue
router.post('/', requireAuth, async (req, res) => {
    try {
        const { clientNumber, station, problemDescription } = req.body;
        
        const hotspotIssue = new HotspotIssue({
            clientNumber,
            station,
            problemDescription,
            loggedBy: req.session.userId
        });

        await hotspotIssue.save();
        res.status(201).json(hotspotIssue);
    } catch (error) {
        console.error('Error creating hotspot issue:', error);
        res.status(500).json({ error: 'Failed to create hotspot issue' });
    }
});

// Get all hotspot issues
router.get('/', requireAuth, async (req, res) => {
    try {
        const issues = await HotspotIssue.find()
            .sort({ dateLogged: -1 })
            .populate('loggedBy', 'username');
        res.json(issues);
    } catch (error) {
        console.error('Error fetching hotspot issues:', error);
        res.status(500).json({ error: 'Failed to fetch hotspot issues' });
    }
});

// Update hotspot issue status
router.patch('/:id', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const issue = await HotspotIssue.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        
        if (!issue) {
            return res.status(404).json({ error: 'Hotspot issue not found' });
        }
        
        res.json(issue);
    } catch (error) {
        console.error('Error updating hotspot issue:', error);
        res.status(500).json({ error: 'Failed to update hotspot issue' });
    }
});

module.exports = router; 