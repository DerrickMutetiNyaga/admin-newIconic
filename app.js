require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const ticketsRouter = require('./routes/tickets');
const usersRouter = require('./routes/users');
const equipmentRouter = require('./routes/equipment');
const equipmentAssignmentsRouter = require('./routes/equipment-assignments');
const { startScheduler } = require('./utils/scheduler');
const { checkAndSendFollowUps } = require('./utils/followUpService');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sendSMS } = require('./utils/sms');
const stationsRouter = require('./routes/stations');
const hotspotIssuesRouter = require('./routes/hotspot-issues');

const app = express();

// Middleware
app.use(cors({ 
    origin: 'http://localhost:3000',
    credentials: true 
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        const { startReminderScheduler } = require('./utils/reminderService');
        startReminderScheduler();
        console.log('Reminder scheduler started');
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Models
const Ticket = require('./models/Ticket');
const Expense = require('./models/Expense');
const User = require('./models/User');

// Session configuration with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        ttl: 24 * 60 * 60 // Session TTL (1 day)
    }),
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    proxy: false
}));

// Trust proxy setting (disabled for localhost)
// app.set('trust proxy', 1);

// Debug route to check session
app.get('/check-session', (req, res) => {
    console.log('Session data:', req.session);
    res.json({ 
        session: req.session,
        cookies: req.cookies,
        headers: req.headers
    });
});

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Role-based access middleware
const enforceRoleAccess = (req, res, next) => {
    const userRole = req.session.userRole?.toLowerCase();

    if (userRole === 'juniorstaff') {
        // JuniorStaff restrictions - can only view and edit tickets
        const allowedPaths = [
            '/tickets.html',
            '/api/tickets',
            '/api/auth/logout',
            '/api/auth/check',
            '/login.html'
        ];

        const isAllowedPath = allowedPaths.some(path => req.path.startsWith(path));
        
        // Only allow GET and PUT methods for tickets
        if (req.path.startsWith('/api/tickets')) {
            if (req.method === 'POST' || req.method === 'DELETE') {
                return res.status(403).json({ error: 'Junior Staff members cannot create or delete tickets' });
            }
        }

        if (!isAllowedPath) {
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(403).json({ error: 'Access denied' });
            }
            return res.redirect('/tickets.html');
        }
    } else if (userRole === 'staff') {
        // Staff restrictions - only allowed to access tickets, equipment, and equipment assignments
        const allowedPaths = [
            '/tickets.html',
            '/api/tickets',
            '/equipment.html',
            '/api/equipment',
            '/equipment-assignment.html',
            '/api/equipment-assignments',
            '/hotspot-issues.html',  // Add hotspot issues page
            '/api/hotspot-issues',   // Add hotspot issues API
            '/api/auth/logout',
            '/api/auth/check',
            '/login.html',
            '/styles.css',  // Required for styling
            '/js/',         // Required for JavaScript files
            '/css/',        // Required for CSS files
            '/fonts/',      // Required for fonts
            '/cdnjs/',      // Required for CDN resources
            '/cdn.jsdelivr.net/'  // Required for CDN resources
        ];

        // Check if the path is allowed
        const isAllowedPath = allowedPaths.some(path => req.path.startsWith(path)) ||
            req.path.includes('chart.js') ||
            req.path.includes('flatpickr') ||
            req.path.includes('cdn') ||
            req.path.includes('fonts');

        // Handle unauthorized access
        if (!isAllowedPath) {
            // For API requests, return 403
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // For page requests, log out and redirect to login
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
                return res.redirect('/login.html');
            });
            return;
        }

        // Handle API paths
        if (req.path.startsWith('/api/')) {
            // Prevent staff from deleting equipment
            if (req.path.startsWith('/api/equipment') && req.method === 'DELETE') {
                return res.status(403).json({ error: 'Staff members cannot delete equipment' });
            }
            
            // Block all access to stations endpoint
            if (req.path.startsWith('/api/stations')) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Handle equipment and assignment endpoints
            if (req.path.startsWith('/api/equipment') || req.path.startsWith('/api/equipment-assignments')) {
                return next();
            }
            
            // For all other API paths
        if (!isAllowedPath) {
                return res.status(403).json({ error: 'Access denied' });
            }
            return next();
        }

        // For root path, redirect to tickets page
        if (req.path === '/' || req.path === '/index.html') {
            return res.redirect('/tickets.html');
        }

        return next();
    } else if (userRole === 'admin') {
        // Admin restrictions
        const allowedPaths = [
            '/',
            '/index.html',
            '/tickets.html',
            '/expenses.html',
            '/hotspot-issues.html',  // Add hotspot issues page
            '/api/hotspot-issues',   // Add hotspot issues API
            '/api/tickets',
            '/api/expenses',
            '/api/dashboard/stats',
            '/api/auth/logout',
            '/api/auth/check',
            '/login.html',
            '/styles.css',
            '/app.js',
            '/mobile-nav.js',
            '/chart.js',
            '/flatpickr',
            '/cdnjs',
            '/cdn.jsdelivr.net',
            '/fonts'
        ];

        // Check if the path starts with any of the allowed paths or contains CDN resources
        const isAllowedPath = allowedPaths.some(path => req.path.startsWith(path)) ||
            req.path.includes('chart.js') ||
            req.path.includes('flatpickr') ||
            req.path.includes('cdn') ||
            req.path.includes('fonts');

        if (!isAllowedPath) {
            if (req.xhr || req.path.startsWith('/api/')) {
                return res.status(403).json({ error: 'Access denied' });
            }
            return res.redirect('/index.html');
        }
    }
    next();
};

// Add the middleware to your app
app.use(enforceRoleAccess);

// Routes
app.get('/', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }

        // Check user role and redirect accordingly
        const userRole = req.session.userRole?.toLowerCase();
        console.log('Root route - User role:', userRole);
        
        switch (userRole) {
            case 'user':
            return res.redirect('/blank.html');
        case 'juniorstaff':
        case 'staff':
            return res.redirect('/tickets.html');
            case 'admin':
            return res.redirect('/tickets.html');
            case 'superadmin':
            return res.sendFile(path.join(__dirname, 'public', 'index.html'));
            default:
            console.log('Unknown role, redirecting to login');
            return res.redirect('/login.html');
    }
});

// Authentication Routes
app.get('/login.html', (req, res) => {
    if (req.session.userId) {
        res.redirect('/');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

app.get('/signup.html', (req, res) => {
    if (req.session.userId) {
        res.redirect('/');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'signup.html'));
    }
});

app.get('/api/auth/check', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ 
        authenticated: true,
        userId: req.session.userId,
        username: req.session.username,
        role: req.session.userRole
    });
});

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if username or email already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: existingUser.username === username ? 
                    'Username already exists' : 'Email already exists'
            });
        }

        // Create new user
        const user = new User({
            username,
            email,
            password
        });

        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt for username:', username);

        const user = await User.findOne({ username });
        console.log('Found user:', user ? 'Yes' : 'No');

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        console.log('Password match:', isMatch);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Set session data
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.userRole = user.role;

        // Debug logging
        console.log('User details:', {
            id: user._id,
            username: user.username,
            role: user.role,
            roleType: typeof user.role
        });

        // Save session before sending response
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            
            // Set response headers for CORS
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
            
            res.json({ 
                success: true, 
                username: user.username,
                role: user.role,
                redirectUrl: '/tickets.html'
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// API Routes
app.use('/api/tickets', ticketsRouter);
app.use('/api/users', usersRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/equipment-assignments', equipmentAssignmentsRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/hotspot-issues', hotspotIssuesRouter);
app.use('/api/reminders', require('./routes/reminders'));

// Excel Export endpoint
app.get('/api/tickets/export', requireAuth, async (req, res) => {
    try {
        const { station, period } = req.query;
        
        // Build the query based on station and period
        let query = { stationLocation: station };
        
        // Add date filter based on period
        const now = new Date();
        switch (period) {
            case 'week':
                query.reportedDateTime = {
                    $gte: new Date(now.setDate(now.getDate() - 7))
                };
                break;
            case 'month':
                query.reportedDateTime = {
                    $gte: new Date(now.setMonth(now.getMonth() - 1))
                };
                break;
            case 'year':
                query.reportedDateTime = {
                    $gte: new Date(now.setFullYear(now.getFullYear() - 1))
                };
                break;
        }

        // Fetch tickets
        const tickets = await Ticket.find(query).sort({ reportedDateTime: -1 });

        // Prepare data for Excel
        const excelData = tickets.map(ticket => ({
            'Ticket ID': ticket._id,
            'Client Name': ticket.clientName,
            'Client Number': ticket.clientNumber,
            'Station': ticket.stationLocation,
            'House Number': ticket.houseNumber,
            'Category': ticket.category,
            'Problem Description': ticket.problemDescription,
            'Status': ticket.status,
            'Reported Date': new Date(ticket.reportedDateTime).toLocaleString(),
            'Created At': new Date(ticket.createdAt).toLocaleString(),
            'Updated At': new Date(ticket.updatedAt).toLocaleString()
        }));

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=tickets-${station}-${period}.xlsx`);

        // Send the Excel file
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error exporting tickets:', error);
        res.status(500).json({ error: 'Failed to export tickets' });
    }
});

// Get all tickets
app.get('/api/tickets', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 0; // If limit is not provided, return all tickets
        const query = Ticket.find().sort({ reportedDateTime: -1 });
        
        if (limit > 0) {
            query.limit(limit);
        }
        
        const tickets = await query;
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// Filter tickets endpoint
app.get('/api/tickets/filter', requireAuth, async (req, res) => {
    try {
        const { search, category, status, station } = req.query;
        
        // Build the query
        let query = {};
        
        // Add search condition if search term exists and is not empty
        if (search && search.trim() !== '') {
            query.$or = [
                { clientName: { $regex: search.trim(), $options: 'i' } },
                { clientNumber: { $regex: search.trim(), $options: 'i' } },
                { houseNumber: { $regex: search.trim(), $options: 'i' } },
                { stationLocation: { $regex: search.trim(), $options: 'i' } },
                { problemDescription: { $regex: search.trim(), $options: 'i' } }
            ];
        }
        
        // Add category filter if specified and not empty
        if (category && category.trim() !== '' && category !== 'All Categories') {
            query.category = category;
        }
        
        // Add status filter if specified and not empty
        if (status && status.trim() !== '' && status !== 'All Status') {
            query.status = status;
        }
        
        // Add station filter if specified and not empty
        if (station && station.trim() !== '' && station !== 'All Stations') {
            query.stationLocation = station;
        }

        console.log('MongoDB query:', JSON.stringify(query, null, 2)); // Debug log

        // Execute the query
        const tickets = await Ticket.find(query).sort({ reportedDateTime: -1 });
        console.log(`Found ${tickets.length} tickets`); // Debug log

        res.json(tickets);
    } catch (error) {
        console.error('Error filtering tickets:', error);
        res.status(500).json({ 
            error: 'Failed to filter tickets',
            details: error.message
        });
    }
});

// Search tickets endpoint
app.get('/api/tickets/search', requireAuth, async (req, res) => {
    try {
        const { term } = req.query;
        
        if (!term || term.trim() === '') {
            // If no search term, return all tickets
            const tickets = await Ticket.find().sort({ reportedDateTime: -1 });
            return res.json(tickets);
        }

        // Build the search query
        const searchQuery = {
            $or: [
                { clientName: { $regex: term, $options: 'i' } },
                { clientNumber: { $regex: term, $options: 'i' } },
                { houseNumber: { $regex: term, $options: 'i' } },
                { stationLocation: { $regex: term, $options: 'i' } },
                { problemDescription: { $regex: term, $options: 'i' } }
            ]
        };

        console.log('Search query:', searchQuery); // Debug log

        // Execute the search
        const tickets = await Ticket.find(searchQuery).sort({ reportedDateTime: -1 });
        console.log(`Found ${tickets.length} matching tickets`); // Debug log

        res.json(tickets);
    } catch (error) {
        console.error('Error searching tickets:', error);
        res.status(500).json({ 
            error: 'Failed to search tickets',
            details: error.message
        });
    }
});

// Get a single ticket by ID
app.get('/api/tickets/:id', requireAuth, async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket);
    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ error: 'Failed to fetch ticket' });
    }
});

// Add route to delete ticket
app.delete('/api/tickets/:id', requireAuth, async (req, res) => {
    try {
        const ticket = await Ticket.findByIdAndDelete(req.params.id);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json({ message: 'Ticket deleted successfully' });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tickets/:id', requireAuth, async (req, res) => {
    try {
        const ticket = await Ticket.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(ticket);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/expenses', requireAuth, async (req, res) => {
    try {
        const expense = new Expense(req.body);
        await expense.save();
        res.status(201).json(expense);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/expenses', requireAuth, async (req, res) => {
    try {
        const expenses = await Expense.find().sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a single expense by ID
app.get('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json(expense);
    } catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add PUT endpoint for updating expenses
app.put('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const expense = await Expense.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json(expense);
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add DELETE endpoint for expenses
app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
    try {
        const expense = await Expense.findByIdAndDelete(req.params.id);
        if (!expense) {
            return res.status(404).json({ error: 'Expense not found' });
        }
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard Stats API
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
        console.log('Fetching dashboard stats...');
        const [tickets, expenses] = await Promise.all([
            Ticket.find().sort({ createdAt: -1 }),
            Expense.find()
        ]);

        console.log(`Found ${tickets.length} tickets and ${expenses.length} expenses`);

        // Group tickets by station
        const ticketsByStation = {
            'NYS GILGI': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } },
            'NYS NAIVASHA': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } },
            'MARRIEDQUARTERS': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } },
            '5KRMAIN CAMP': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } }
        };

        // Sort tickets to show open tickets first
        const sortedTickets = [...tickets].sort((a, b) => {
            if (a.status === 'Open' && b.status !== 'Open') return -1;
            if (a.status !== 'Open' && b.status === 'Open') return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Group tickets by station
        sortedTickets.forEach(ticket => {
            const station = ticketsByStation[ticket.stationLocation];
            if (station) {
                station.total++;
                station[ticket.status.toLowerCase().replace(' ', '')]++;
                station.tickets.push(ticket);
                station.categories[ticket.category]++;
            } else {
                console.warn('Unknown station:', ticket.stationLocation);
            }
        });

        const stats = {
            totalTickets: tickets.length,
            openTickets: tickets.filter(t => t.status === 'Open').length,
            inProgressTickets: tickets.filter(t => t.status === 'In Progress').length,
            resolvedTickets: tickets.filter(t => t.status === 'Resolved').length,
            totalExpenses: expenses.reduce((sum, exp) => sum + exp.amount, 0),
            monthlyExpenses: expenses
                .filter(exp => new Date(exp.date).getMonth() === new Date().getMonth())
                .reduce((sum, exp) => sum + exp.amount, 0),
            ticketsByStation,
            recentExpenses: expenses.slice(0, 15)
        };

        console.log('Dashboard stats compiled successfully');
        res.json(stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats', details: error.message });
    }
});

// Get Open Tickets
app.get('/api/tickets/open', requireAuth, async (req, res) => {
    try {
        const openTickets = await Ticket.find({ status: 'Open' }).sort({ createdAt: -1 });
        res.json(openTickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the follow-up scheduler
startScheduler();

// Schedule follow-up checks to run every hour
setInterval(checkAndSendFollowUps, 60 * 60 * 1000);

// Initial follow-up check
checkAndSendFollowUps();

// Rate limiting middleware
const recoveryLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour (back to production setting)
    message: { error: 'Too many recovery attempts. Please try again later.' }
});

// Email transporter configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Verify username route
app.post('/api/auth/verify-username', recoveryLimiter, async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(404).json({ error: 'Username not found' });
        }

        // Return both masked and full email for verification
        const [emailUsername, domain] = user.email.split('@');
        const maskedEmail = `${emailUsername.charAt(0)}${'*'.repeat(emailUsername.length - 2)}${emailUsername.charAt(emailUsername.length - 1)}@${domain}`;

        res.json({ 
            success: true,
            maskedEmail,
            fullEmail: user.email
        });
    } catch (error) {
        console.error('Error verifying username:', error);
        res.status(500).json({ error: 'An error occurred while verifying username' });
    }
});

// Forgot password route
app.post('/api/auth/forgot-password', recoveryLimiter, async (req, res) => {
    try {
        const { username, email, phone } = req.body;
        const user = await User.findOne({ username, email });

        if (!user) {
            return res.status(404).json({ error: 'Invalid username or email' });
        }

        // Check if user can attempt recovery
        if (!user.canAttemptRecovery()) {
            return res.status(429).json({ 
                error: 'Too many recovery attempts. Please try again later.' 
            });
        }

        // Generate recovery token
        const token = await user.generateRecoveryToken();
        
        // Create recovery URL
        const recoveryUrl = `${process.env.BASE_URL}/reset-password.html?token=${token}`;
        
        // Format phone number (remove any non-digit characters and ensure it starts with country code)
        let formattedPhone = phone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('254')) {
            formattedPhone = '254' + formattedPhone.replace(/^0+/, '');
        }
        formattedPhone = '+' + formattedPhone;
        
        // Send SMS with recovery link
        const smsMessage = `Your password recovery link: ${recoveryUrl}. This link will expire in 1 hour.`;
        
        try {
            await sendSMS(smsMessage, formattedPhone);
        } catch (smsError) {
            console.error('Error sending SMS:', smsError);
            return res.status(500).json({ error: 'Failed to send recovery link via SMS' });
        }

        // Increment recovery attempts
        await user.incrementRecoveryAttempts();

        res.json({ 
            success: true,
            message: 'Recovery link has been sent to your phone number'
        });
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ error: 'An error occurred while processing your request' });
    }
});

// Reset password route
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        // Find user with valid recovery token
        const user = await User.findOne({
            recoveryToken: token,
            recoveryTokenExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired recovery token' });
        }

        // Update password and clear recovery token
        user.password = newPassword;
        user.recoveryToken = undefined;
        user.recoveryTokenExpiry = undefined;
        await user.save();

        res.json({ 
            success: true,
            message: 'Password has been reset successfully'
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'An error occurred while resetting your password' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 