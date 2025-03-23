require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const ticketsRouter = require('./routes/tickets');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Models
const Ticket = require('./models/Ticket');
const Expense = require('./models/Expense');
const User = require('./models/User');

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Routes
app.get('/', (req, res) => {
    if (!req.session.userId) {
        res.redirect('/login.html');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
        const user = await User.findOne({ username });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.userRole = user.role;
        res.json({ 
            success: true, 
            username: user.username,
            role: user.role 
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
        const [tickets, expenses] = await Promise.all([
            Ticket.find().sort({ createdAt: -1 }),
            Expense.find()
        ]);

        // Group tickets by station
        const ticketsByStation = {
            'Gilgil': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } },
            'Naivasha': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } },
            'Muranga': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } },
            'Prof': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } },
            'Exec': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } },
            'Married': { total: 0, open: 0, inProgress: 0, resolved: 0, tickets: [], categories: { Installation: 0, LOS: 0, Other: 0 } }
        };

        // Sort tickets to show open tickets first
        const sortedTickets = [...tickets].sort((a, b) => {
            if (a.status === 'Open' && b.status !== 'Open') return -1;
            if (a.status !== 'Open' && b.status === 'Open') return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Group tickets by station
        sortedTickets.forEach(ticket => {
            if (ticketsByStation[ticket.stationLocation]) {
                ticketsByStation[ticket.stationLocation].total++;
                ticketsByStation[ticket.stationLocation][ticket.status.toLowerCase().replace(' ', '')]++;
                ticketsByStation[ticket.stationLocation].tickets.push(ticket);
                ticketsByStation[ticket.stationLocation].categories[ticket.category]++;
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

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

// SMS Function
async function sendSMS(phoneNumber, message) {
    try {
        const formData = new URLSearchParams();
        formData.append('userid', process.env.ZETTATEL_USERNAME);
        formData.append('password', encodeURIComponent(process.env.ZETTATEL_PASSWORD));
        formData.append('sendMethod', 'quick');
        formData.append('mobile', phoneNumber);
        formData.append('msg', message);
        formData.append('senderid', process.env.SENDER_ID);
        formData.append('msgType', 'text');
        formData.append('duplicatecheck', 'true');
        formData.append('output', 'json');

        const response = await axios.post(process.env.ZETTATEL_API_URL, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log(`SMS sent to ${phoneNumber}:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error sending SMS to ${phoneNumber}:`, error.response ? error.response.data : error.message);
        throw error;
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 