const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const XLSX = require('xlsx');
const { sendSMS } = require('../utils/sms');

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Get monthly ticket statistics for charts
router.get('/monthly-stats', requireAuth, async (req, res) => {
    try {
        // Get all tickets for processing
        const tickets = await Ticket.find().sort({ reportedDateTime: -1 });
        
        // Get current month and year
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Filter tickets for current month
        const currentMonthTickets = tickets.filter(ticket => {
            const ticketDate = new Date(ticket.reportedDateTime);
            return ticketDate.getMonth() === currentMonth && 
                   ticketDate.getFullYear() === currentYear;
        });

        // Calculate status distribution for current month
        const statusStats = {
            open: currentMonthTickets.filter(t => t.status === 'Open').length,
            inProgress: currentMonthTickets.filter(t => t.status === 'In Progress').length,
            resolved: currentMonthTickets.filter(t => t.status === 'Resolved').length
        };

        // Initialize monthly category arrays
        const categoryStats = {
            installation: Array(12).fill(0),
            los: Array(12).fill(0),
            other: Array(12).fill(0)
        };

        // Calculate monthly category distribution for current year
        tickets.forEach(ticket => {
            const ticketDate = new Date(ticket.reportedDateTime);
            if (ticketDate.getFullYear() === currentYear) {
                const month = ticketDate.getMonth();
                switch(ticket.category) {
                    case 'Installation':
                        categoryStats.installation[month]++;
                        break;
                    case 'LOS':
                        categoryStats.los[month]++;
                        break;
                    default:
                        categoryStats.other[month]++;
                }
            }
        });

        // Calculate yearly trends
        const years = [...new Set(tickets.map(ticket => 
            new Date(ticket.reportedDateTime).getFullYear()
        ))].sort();

        const yearlyTrend = years.map(year => {
            const monthlyData = Array(12).fill(0);
            tickets.forEach(ticket => {
                const ticketDate = new Date(ticket.reportedDateTime);
                if (ticketDate.getFullYear() === year) {
                    monthlyData[ticketDate.getMonth()]++;
                }
            });
            return {
                year,
                data: monthlyData
            };
        });

        res.json({
            month: now.toLocaleString('default', { month: 'long' }),
            year: currentYear,
            total: currentMonthTickets.length,
            statusStats,
            categoryStats,
            yearlyTrend
        });

    } catch (error) {
        console.error('Error fetching monthly stats:', error);
        res.status(500).json({ 
            error: 'Failed to fetch monthly statistics',
            details: error.message 
        });
    }
});

// Filter tickets endpoint
router.get('/filter', requireAuth, async (req, res) => {
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

        // Execute the query
        const tickets = await Ticket.find(query).sort({ reportedDateTime: -1 });
        res.json(tickets);
    } catch (error) {
        console.error('Error filtering tickets:', error);
        res.status(500).json({ 
            error: 'Failed to filter tickets',
            details: error.message
        });
    }
});

// Get tickets for a specific station
router.get('/station/:station', requireAuth, async (req, res) => {
    try {
        const station = req.params.station;
        
        // Fetch tickets for the station
        const tickets = await Ticket.find({ stationLocation: station })
            .sort({ reportedDateTime: -1 });

        // Calculate statistics
        const stats = {
            total: tickets.length,
            open: tickets.filter(t => t.status.toLowerCase() === 'open').length,
            inProgress: tickets.filter(t => t.status.toLowerCase() === 'in progress').length,
            resolved: tickets.filter(t => t.status.toLowerCase() === 'resolved').length
        };

        // Map tickets to include only necessary fields
        const mappedTickets = tickets.map(ticket => ({
            _id: ticket._id,
            clientName: ticket.clientName,
            clientNumber: ticket.clientNumber,
            houseNumber: ticket.houseNumber,
            problemDescription: ticket.problemDescription,
            status: ticket.status,
            reportedDateTime: ticket.reportedDateTime,
            category: ticket.category
        }));

        res.json({
            stats,
            tickets: mappedTickets
        });
    } catch (error) {
        console.error('Error fetching station tickets:', error);
        res.status(500).json({ error: 'Failed to fetch station tickets' });
    }
});

// Get all tickets
router.get('/', requireAuth, async (req, res) => {
    try {
        const tickets = await Ticket.find().sort({ reportedDateTime: -1 });
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// Create a new ticket
router.post('/', requireAuth, async (req, res) => {
    try {
        const ticket = new Ticket(req.body);
        await ticket.save();

        // Send SMS notification
        const phoneNumbers = process.env.PHONE_NUMBERS;
        const message = `New ticket created:\nClient: ${ticket.clientName}\nLocation: ${ticket.stationLocation}\nHouse: ${ticket.houseNumber}\nCategory: ${ticket.category}\nStatus: ${ticket.status}`;
        
        await sendSMS(phoneNumbers, message);

        res.status(201).json(ticket);
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

// Export tickets endpoint
router.get('/export', requireAuth, async (req, res) => {
    try {
        const { startDate, endDate, station } = req.query;
        
        // Build the query
        let query = {};
        
        // Add date range filter if provided
        if (startDate && endDate) {
            query.reportedDateTime = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        // Add station filter if provided
        if (station && station !== 'All Stations') {
            query.stationLocation = station;
        }

        // Fetch tickets
        const tickets = await Ticket.find(query).sort({ reportedDateTime: -1 });

        // Prepare data for Excel
        const excelData = tickets.map(ticket => ({
            'Ticket ID': ticket._id,
            'Client Name': ticket.clientName,
            'Client Number': ticket.clientNumber,
            'House Number': ticket.houseNumber,
            'Station': ticket.stationLocation,
            'Category': ticket.category,
            'Status': ticket.status,
            'Problem Description': ticket.problemDescription,
            'Reported Date': new Date(ticket.reportedDateTime).toLocaleString(),
            'Last Updated': new Date(ticket.updatedAt).toLocaleString()
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
        res.setHeader('Content-Disposition', 'attachment; filename=tickets.xlsx');

        // Send the file
        res.send(excelBuffer);
    } catch (error) {
        console.error('Error exporting tickets:', error);
        res.status(500).json({ error: 'Failed to export tickets' });
    }
});

// Get a single ticket
router.get('/:id', requireAuth, async (req, res) => {
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

// Update a ticket
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const ticket = await Ticket.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket);
    } catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

// Delete a ticket
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const ticket = await Ticket.findByIdAndDelete(req.params.id);
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json({ message: 'Ticket deleted successfully' });
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ error: 'Failed to delete ticket' });
    }
});

module.exports = router; 