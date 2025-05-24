const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Middleware to check if user is superadmin
const requireSuperAdmin = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const user = await User.findById(req.session.userId);
        if (!user || user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all users (superadmin only)
router.get('/', requireSuperAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create new user (superadmin only)
router.post('/', requireSuperAdmin, async (req, res) => {
    try {
        const { username, email, password, role, status } = req.body;

        // Check if username or email already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'Username or email already exists'
            });
        }

        const user = new User({
            username,
            email,
            password,
            role,
            status
        });

        await user.save();
        
        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Get single user (superadmin only)
router.get('/:id', requireSuperAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user (superadmin only)
router.put('/:id', requireSuperAdmin, async (req, res) => {
    try {
        const { username, email, role, status } = req.body;

        // Check if username or email already exists for other users
        const existingUser = await User.findOne({
            _id: { $ne: req.params.id },
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'Username or email already exists'
            });
        }

        // Prevent removing the last superadmin
        if (role !== 'superadmin') {
            const currentUser = await User.findById(req.params.id);
            if (currentUser.role === 'superadmin') {
                const superadminCount = await User.countDocuments({ role: 'superadmin' });
                if (superadminCount <= 1) {
                    return res.status(400).json({
                        error: 'Cannot remove the last superadmin'
                    });
                }
            }
        }

        const updateData = { username, email, role, status };
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (superadmin only)
router.delete('/:id', requireSuperAdmin, async (req, res) => {
    try {
        // Prevent deleting the last superadmin
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role === 'superadmin') {
            const superadminCount = await User.countDocuments({ role: 'superadmin' });
            if (superadminCount <= 1) {
                return res.status(400).json({
                    error: 'Cannot delete the last superadmin'
                });
            }
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Change password (superadmin only)
router.put('/:id/password', requireSuperAdmin, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { password: hashedPassword },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

module.exports = router; 