// DOM Elements
function getDOMElements() {
    return {
        ticketModal: document.getElementById('ticketModal'),
        expenseModal: document.getElementById('expenseModal'),
        editTicketModal: document.getElementById('editTicketModal'),
        editExpenseModal: document.getElementById('editExpenseModal'),
        ticketForm: document.getElementById('ticketForm'),
        expenseForm: document.getElementById('expenseForm'),
        editTicketForm: document.getElementById('editTicketForm'),
        editExpenseForm: document.getElementById('editExpenseForm'),
        navLinks: document.querySelectorAll('.nav-links a'),
        newTicketBtn: document.getElementById('newTicketBtn'),
        newExpenseBtn: document.getElementById('newExpenseBtn'),
        closeButtons: document.querySelectorAll('.close-modal')
    };
}

// Charts
let stationCategoriesChart;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    const elements = getDOMElements();
    setupEventListeners(elements);
    initializeCharts();
    updateCurrentDate();
    initializeStationTabs();
    loadDashboardData();
    initializeMobileNavigation();
});

// Authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        const data = await response.json();
        if (!data.authenticated) {
            window.location.href = '/login.html';
            return;
        }
        document.getElementById('username').textContent = data.username;
        loadDashboardData();
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
    }
}

// Event Listeners
function setupEventListeners(elements) {
    // Navigation
    if (elements.navLinks) {
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.closest('a').dataset.page;
                if (page) {
                    navigateToPage(page);
                } else {
                    // Handle direct href links
                    const href = e.target.closest('a').getAttribute('href');
                    if (href) {
                        window.location.href = href;
                    }
                }
            });
        });
    }

    // Forms
    if (elements.ticketForm) {
        elements.ticketForm.addEventListener('submit', handleTicketSubmit);
    }
    
    if (elements.expenseForm) {
        elements.expenseForm.addEventListener('submit', handleExpenseSubmit);
    }

    // Modal Buttons
    if (elements.newTicketBtn) {
        elements.newTicketBtn.addEventListener('click', () => showModal('ticketModal'));
    }
    
    if (elements.newExpenseBtn) {
        elements.newExpenseBtn.addEventListener('click', () => showModal('expenseModal'));
    }

    if (elements.closeButtons) {
        elements.closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
                if (modal) closeModal(modal.id);
        });
    });
    }

    // Logout
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Edit Forms
    if (elements.editTicketForm) {
        elements.editTicketForm.addEventListener('submit', handleTicketEdit);
    }
    
    if (elements.editExpenseForm) {
        elements.editExpenseForm.addEventListener('submit', handleExpenseEdit);
    }

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
}

// Navigation
function navigateToPage(page) {
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => link.classList.remove('active'));
    event.target.closest('a').classList.add('active');
    
    // Update header
    document.querySelector('header h1').textContent = page.charAt(0).toUpperCase() + page.slice(1);
    
    // Load page-specific content
    switch(page) {
        case 'dashboard':
            window.location.href = '/index.html';
            break;
        case 'tickets':
            window.location.href = '/tickets.html';
            break;
        case 'expenses':
            window.location.href = '/expenses.html';
            break;
        case 'reports':
            window.location.href = '/reports.html';
            break;
        case 'settings':
            window.location.href = '/settings.html';
            break;
    }
}

// Modal Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Date Formatting
function updateCurrentDate() {
    const date = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = date.toLocaleDateString('en-US', options);
}

// API Calls
async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        const [statsResponse, ticketsResponse] = await Promise.all([
            fetch('/api/dashboard/stats'),
            fetch('/api/tickets?limit=5') // Fetch 5 most recent tickets
        ]);

        if (!statsResponse.ok || !ticketsResponse.ok) {
            throw new Error('Failed to load dashboard data');
        }

        const stats = await statsResponse.json();
        const recentTickets = await ticketsResponse.json();

        console.log('Dashboard stats:', stats);
        console.log('Recent tickets:', recentTickets);

        // Update stats display
        updateDashboardStats(stats);
        
        // Initialize chart if not already initialized
        if (!stationCategoriesChart) {
            initializeCharts();
        }
        
        // Update charts with initial data
        if (stationCategoriesChart) {
            console.log('Updating chart with data:', stats.stationCategories);
            
            // Default to 0 if data is not available
            const categories = {
                installation: 0,
                los: 0,
                other: 0
            };

            // If we have station categories data, use it
            if (stats.stationCategories) {
                categories.installation = stats.stationCategories.installation || 0;
                categories.los = stats.stationCategories.los || 0;
                categories.other = stats.stationCategories.other || 0;
            } 
            // Otherwise try to use ticket status counts if available
            else if (stats.stats) {
                categories.installation = stats.stats.open || 0;
                categories.los = stats.stats.inProgress || 0;
                categories.other = stats.stats.resolved || 0;
            }
            
            stationCategoriesChart.data.datasets[0].data = [
                categories.installation,
                categories.los,
                categories.other
            ];
            stationCategoriesChart.update('none');
            console.log('Chart updated with categories:', categories);
        }

        // Update recent tickets and expenses
        updateRecentTickets(recentTickets);
        if (stats.recentExpenses) {
        updateRecentExpenses(stats);
        }
        
        // Load initial station data
        await loadStationData('Gilgil');
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

// Initialize station tabs
function initializeStationTabs() {
    const tabs = document.querySelectorAll('.station-tab');
    const statusFilter = document.getElementById('stationStatusFilter');
    const searchInput = document.getElementById('stationSearchInput');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            // Load data for selected station
            loadStationData(tab.dataset.station);
        });
    });

    // Add event listeners for filters
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            const activeTab = document.querySelector('.station-tab.active');
            if (activeTab) {
                loadStationData(activeTab.dataset.station);
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            const activeTab = document.querySelector('.station-tab.active');
            if (activeTab) {
                loadStationData(activeTab.dataset.station);
            }
        }, 300));
    }

    // Load initial station data (Gilgil by default)
    loadStationData('Gilgil');
}

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load station data
async function loadStationData(station) {
    try {
        const statusFilter = document.getElementById('stationStatusFilter')?.value;
        const searchQuery = document.getElementById('stationSearchInput')?.value;
        
        let url = `/api/tickets/station/${station}`;
        const params = new URLSearchParams();
        
        if (statusFilter) params.append('status', statusFilter);
        if (searchQuery) params.append('search', searchQuery);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to load station data');
        }
        const data = await response.json();
        
        // Update the station display with the fetched data
        updateStationDisplay(data);
        
        // Update the station name in the header
        const stationHeader = document.getElementById('stationHeader');
        if (stationHeader) {
            stationHeader.textContent = `${station} Station`;
        }
    } catch (error) {
        console.error('Error loading station data:', error);
        showNotification('Error loading station data', 'error');
    }
}

// Dashboard Updates
function updateDashboardStats(stats) {
    document.getElementById('totalTickets').textContent = stats.totalTickets;
    document.getElementById('openTickets').textContent = stats.openTickets;
    document.getElementById('inProgressTickets').textContent = stats.inProgressTickets;
    document.getElementById('resolvedTickets').textContent = stats.resolvedTickets;
    document.getElementById('totalExpenses').textContent = `Ksh ${stats.totalExpenses.toFixed(2)}`;
    document.getElementById('monthlyExpenses').textContent = `ksh ${stats.monthlyExpenses.toFixed(2)}`;
}

function updateRecentExpenses(stats) {
    const recentExpensesList = document.getElementById('recentExpensesList');
    
    if (!stats.recentExpenses || stats.recentExpenses.length === 0) {
        recentExpensesList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-receipt"></i>
                <p>No recent expenses found</p>
            </div>
        `;
        return;
    }

    recentExpensesList.innerHTML = stats.recentExpenses.map(expense => `
        <div class="activity-item expense">
            <div class="activity-content">
                <div class="activity-header">
                    <div class="header-left">
                        <h4>${expense.name}</h4>
                        <span class="category-badge ${expense.category.toLowerCase()}">${expense.category}</span>
                    </div>
                    <div class="activity-actions">
                        <button class="action-btn edit" onclick="editExpense('${expense._id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteExpense('${expense._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="activity-details">
                    <div class="detail-row">
                        <span><i class="fas fa-money-bill-wave"></i> KSH ${expense.amount.toFixed(2)}</span>
                        <span><i class="fas fa-calendar"></i> ${new Date(expense.date).toLocaleString()}</span>
                        <span><i class="fas fa-credit-card"></i> ${expense.paymentMethod || 'Not specified'}</span>
                    </div>
                    <div class="activity-description">
                        <i class="fas fa-info-circle"></i>
                        <p>${expense.notes || 'No additional notes'}</p>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Charts
function initializeCharts() {
    console.log('Initializing charts...');
    const stationCategoriesCtx = document.getElementById('stationCategoriesChart');
    if (!stationCategoriesCtx) {
        console.error('Chart canvas not found');
        return;
    }

    console.log('Chart canvas found, creating chart...');
    const ctx = stationCategoriesCtx.getContext('2d');
    stationCategoriesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Installation', 'LOS', 'Other'],
            datasets: [{
                data: [1, 1, 1], // Set initial data to 1 to make the chart visible
                backgroundColor: ['#3498db', '#e74c3c', '#2ecc71'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
    console.log('Chart created successfully');
}

function updateCharts(stats) {
    // Update Station Categories Chart
    if (stats.stationCategories) {
        stationCategoriesChart.data.datasets[0].data = [
            stats.stationCategories.installation || 0,
            stats.stationCategories.los || 0,
            stats.stationCategories.other || 0
        ];
        stationCategoriesChart.update();
    }
}

// Form Handlers
async function handleTicketSubmit(e) {
    const formData = new FormData(e.target);
    const ticketData = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ticketData)
        });

        if (!response.ok) throw new Error('Failed to create ticket');

        closeModal('ticketModal');
        e.target.reset();
        showNotification('Ticket created successfully', 'success');
        loadTickets(); // Refresh the ticket list
    } catch (error) {
        console.error('Error creating ticket:', error);
        showNotification('Failed to create ticket', 'error');
    }
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('expenseName').value,
        category: document.getElementById('expenseCategory').value,
        amount: parseFloat(document.getElementById('expenseAmount').value),
        date: document.getElementById('expenseDate').value,
        paymentMethod: document.getElementById('expensePaymentMethod').value,
        notes: document.getElementById('expenseNotes').value
    };

    // Validate required fields
    if (!formData.name || !formData.category || !formData.amount || !formData.date || !formData.paymentMethod) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Failed to add expense');
        }

        showNotification('Expense added successfully', 'success');
        closeModal('expenseModal');
        
        // Reset form
        document.getElementById('expenseForm').reset();
        
        // Refresh dashboard data
        await loadDashboardData();
    } catch (error) {
        console.error('Error adding expense:', error);
        showNotification('Error adding expense', 'error');
    }
}

// Logout Handler
async function handleLogout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        if (response.ok) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Edit Ticket
async function editTicket(ticketId) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}`);
        if (!response.ok) throw new Error('Failed to fetch ticket');
        const ticket = await response.json();
        
        // Populate the edit form
        document.getElementById('editTicketId').value = ticket._id;
        document.getElementById('editTicketStatus').value = ticket.status;
        
        // Show the modal
        showModal('editTicketModal');
    } catch (error) {
        console.error('Error fetching ticket:', error);
        showNotification('Error fetching ticket details', 'error');
    }
}

function populateEditForm(ticket) {
    const form = document.getElementById('ticketForm');
    if (!form) return;

    // Populate form fields with ticket data
    Object.keys(ticket).forEach(key => {
        const input = form.querySelector(`#${key}`);
        if (input) input.value = ticket[key];
    });

    // Update form title and submit button
    const modalTitle = document.querySelector('#ticketModal h2');
    const submitButton = form.querySelector('button[type="submit"]');
    if (modalTitle) modalTitle.textContent = 'Edit Ticket';
    if (submitButton) submitButton.textContent = 'Update Ticket';

    // Add ticket ID to form for update
    form.dataset.ticketId = ticket.id;
}

// Handle Ticket Edit
async function handleTicketEdit(e) {
    e.preventDefault();
    const ticketId = document.getElementById('editTicketId').value;
    const status = document.getElementById('editTicketStatus').value;
    
    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) throw new Error('Failed to update ticket');
        
        // Close modal and refresh data
        closeModal('editTicketModal');
        showNotification('Ticket status updated successfully', 'success');
        loadDashboardData(); // Refresh the dashboard data
    } catch (error) {
        console.error('Error updating ticket:', error);
        showNotification('Error updating ticket status', 'error');
    }
}

// Delete Ticket
async function deleteTicket(ticketId) {
    if (!confirm('Are you sure you want to delete this ticket?')) {
        return;
    }

    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete ticket');
        }

        showNotification('Ticket deleted successfully', 'success');
        
        // Refresh the dashboard data
        await loadDashboardData();
        
    } catch (error) {
        console.error('Error deleting ticket:', error);
        showNotification('Error deleting ticket', 'error');
    }
}

// Edit Expense
async function editExpense(id) {
    try {
        const response = await fetch(`/api/expenses/${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch expense details');
        }
        const expense = await response.json();
        
        // Populate the edit form
        document.getElementById('editExpenseId').value = expense._id;
        document.getElementById('editExpenseName').value = expense.name;
        document.getElementById('editExpenseCategory').value = expense.category;
        document.getElementById('editExpenseAmount').value = expense.amount;
        document.getElementById('editExpenseDate').value = new Date(expense.date).toISOString().slice(0, 16);
        document.getElementById('editExpensePaymentMethod').value = expense.paymentMethod || '';
        document.getElementById('editExpenseNotes').value = expense.notes || '';
        
        // Show the modal
        showModal('editExpenseModal');
    } catch (error) {
        console.error('Error fetching expense details:', error);
        showNotification('Error loading expense details', 'error');
    }
}

// Handle Expense Edit
async function handleExpenseEdit(e) {
    e.preventDefault();
    
    const id = document.getElementById('editExpenseId').value;
    const formData = {
        name: document.getElementById('editExpenseName').value,
        category: document.getElementById('editExpenseCategory').value,
        amount: parseFloat(document.getElementById('editExpenseAmount').value),
        date: document.getElementById('editExpenseDate').value,
        paymentMethod: document.getElementById('editExpensePaymentMethod').value,
        notes: document.getElementById('editExpenseNotes').value
    };

    // Validate required fields
    if (!formData.name || !formData.category || !formData.amount || !formData.date || !formData.paymentMethod) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/expenses/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Failed to update expense');
        }

        showNotification('Expense updated successfully', 'success');
        closeModal('editExpenseModal');
        
        // Refresh dashboard data
        await loadDashboardData();
    } catch (error) {
        console.error('Error updating expense:', error);
        showNotification('Error updating expense', 'error');
    }
}

// Delete Expense
async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) {
        return;
    }

    try {
        const response = await fetch(`/api/expenses/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            updateDashboard();
            showNotification('Expense deleted successfully', 'success');
        } else {
            throw new Error('Failed to delete expense');
        }
    } catch (error) {
        console.error('Error deleting expense:', error);
        showNotification('Error deleting expense', 'error');
    }
}

// Add notification function
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Update station display
function updateStationDisplay(data) {
    console.log('Station data:', data);
    
    // Ensure we have valid data
    const stats = data?.stats || {
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0
    };
    
    // Update station stats
    const statsContainer = document.getElementById('stationStats');
    if (statsContainer) {
        statsContainer.innerHTML = `
                <div class="station-stat">
                <div class="stat-label">Total Tickets</div>
                <div class="stat-value">${stats.total || 0}</div>
                </div>
                <div class="station-stat">
                <div class="stat-label">Open</div>
                <div class="stat-value open">${stats.open || 0}</div>
                </div>
                <div class="station-stat">
                <div class="stat-label">In Progress</div>
                <div class="stat-value progress">${stats.inProgress || 0}</div>
                </div>
                <div class="station-stat">
                <div class="stat-label">Resolved</div>
                <div class="stat-value resolved">${stats.resolved || 0}</div>
                </div>
        `;
    }

    // Update categories chart
    if (stationCategoriesChart) {
        const categories = {
            installation: stats.open || 0,
            los: stats.inProgress || 0,
            other: stats.resolved || 0
        };
        
        console.log('Updating chart with categories:', categories);
        
        stationCategoriesChart.data.datasets[0].data = [
            categories.installation,
            categories.los,
            categories.other
        ];
        stationCategoriesChart.update('none');
    }

    // Update tickets list
    const ticketsList = document.getElementById('tixList');
    if (ticketsList) {
        if (data?.tickets?.length > 0) {
            ticketsList.innerHTML = data.tickets.map(ticket => {
                const statusColors = {
                    'Open': { bg: '#fef2f2', color: '#ef4444', icon: 'exclamation-circle' },
                    'In Progress': { bg: '#fef3c7', color: '#d97706', icon: 'clock' },
                    'Resolved': { bg: '#f0fdf4', color: '#22c55e', icon: 'check-circle' }
                };
                const status = statusColors[ticket.status] || statusColors['Open'];
                
                return `
                    <div class="tix-item">
                        <div class="tix-item-header">
                            <span class="tix-status-badge ${status.class}" style="background: ${status.bgColor}; color: ${status.color}">
                                <i class="fas fa-${status.icon}"></i>
                                ${ticket.status || 'Open'}
                            </span>
                            <div class="tix-actions">
                                <button class="tix-btn edit" onclick="editTicket('${ticket._id}')" title="Edit Ticket">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="tix-btn delete" onclick="deleteTicket('${ticket._id}')" title="Delete Ticket">
                                    <i class="fas fa-trash"></i>
                                </button>
            </div>
                        </div>
                        <div class="tix-content">
                            <h4 class="tix-client">
                                <i class="fas fa-user-circle"></i>
                                ${ticket.clientName || 'No Name'}
                            </h4>
                            <div class="tix-details">
                                <div class="tix-detail-item">
                                    <i class="fas fa-phone"></i>
                                    <span>${ticket.clientNumber || 'No Number'}</span>
                                </div>
                                <div class="tix-detail-item">
                                    <i class="fas fa-home"></i>
                                    <span>${ticket.houseNumber || 'No House Number'}</span>
                                </div>
                                <div class="tix-detail-item">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>${ticket.stationLocation || 'No Location'}</span>
                                </div>
                            </div>
                            <div class="tix-problem-box">
                                <p>${ticket.problemDescription || 'No Description'}</p>
                            </div>
                        </div>
                        <div class="tix-item-footer">
                            <span class="tix-date">
                                <i class="fas fa-calendar-alt"></i>
                                ${new Date(ticket.reportedDateTime || Date.now()).toLocaleString()}
                            </span>
                            <span class="tix-category-badge cat-${(ticket.category || 'other').toLowerCase()}">
                                <i class="fas fa-tag"></i>
                                ${ticket.category || 'Other'}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            ticketsList.innerHTML = `
                <div class="tix-empty">
                    <i class="fas fa-ticket-alt"></i>
                    <p>No tickets found</p>
                    <span>Try adjusting your filters or create a new ticket</span>
                </div>
            `;
        }
    }
}

// Update categories chart
function updateCategoriesChart(categories) {
    if (!stationCategoriesChart) return;

    stationCategoriesChart.data.datasets[0].data = [
        categories.installation || 0,
        categories.los || 0,
        categories.other || 0
    ];
    stationCategoriesChart.update('none'); // Use 'none' mode for better performance
}

// Update the updateRecentTickets function
function updateRecentTickets(tickets) {
    const recentTicketsList = document.getElementById('recentTicketsList');
    
    if (!tickets || tickets.length === 0) {
        recentTicketsList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-ticket-alt"></i>
                <p>No recent tickets found</p>
            </div>
        `;
        return;
    }

    recentTicketsList.innerHTML = tickets.map(ticket => {
        const statusClass = ticket.status.toLowerCase().replace(' ', '-');
        return `
            <div class="activity-item ticket">
                <div class="activity-content">
                    <div class="activity-header">
                        <div class="header-left">
                            <h4>${ticket.clientName}</h4>
                            <span class="activity-status ${statusClass}">
                                <i class="fas fa-circle"></i> ${ticket.status}
                            </span>
                        </div>
                        <div class="activity-actions">
                            <button class="action-btn edit" onclick="editTicket('${ticket._id}')" title="Edit Status">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="deleteTicket('${ticket._id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="activity-details">
                        <div class="detail-row">
                            <span><i class="fas fa-phone"></i> ${ticket.clientNumber}</span>
                            <span><i class="fas fa-home"></i> ${ticket.houseNumber}</span>
                            <span><i class="fas fa-map-marker-alt"></i> ${ticket.stationLocation}</span>
                        </div>
                        <div class="activity-description">
                            <i class="fas fa-info-circle"></i>
                            <p>${ticket.problemDescription}</p>
                        </div>
                        <div class="activity-meta">
                            <span>
                                <i class="fas fa-calendar"></i>
                                ${new Date(ticket.reportedDateTime || Date.now()).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

let currentPage = 1;
const ticketsPerPage = 10;

function paginateTickets(tickets) {
    const totalPages = Math.ceil(tickets.length / ticketsPerPage);
    const start = (currentPage - 1) * ticketsPerPage;
    const end = start + ticketsPerPage;
    const paginatedTickets = tickets.slice(start, end);

    updateTicketsList(paginatedTickets);
    updatePaginationControls(totalPages);
}

function updatePaginationControls(totalPages) {
    const paginationControls = document.getElementById('paginationControls');
    paginationControls.innerHTML = '';

    if (currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.textContent = 'Previous';
        prevButton.onclick = () => {
            currentPage--;
            paginateTickets(allTickets);
        };
        paginationControls.appendChild(prevButton);
    }

    if (currentPage < totalPages) {
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next';
        nextButton.onclick = () => {
            currentPage++;
            paginateTickets(allTickets);
        };
        paginationControls.appendChild(nextButton);
    }
}

// Modify loadTickets to use pagination
async function loadTickets() {
    try {
        console.log('Loading tickets...');
        const response = await fetch('/api/tickets');
        if (!response.ok) {
            const error = await response.json();
            console.error('Server error:', error);
            throw new Error(error.error || 'Failed to load tickets');
        }
        allTickets = await response.json();
        console.log('Loaded tickets:', allTickets);
        paginateTickets(allTickets);
        updateTicketStats(allTickets);
        updateCharts(allTickets);
    } catch (error) {
        console.error('Error loading tickets:', error);
        showNotification('Error loading tickets', 'error');
    }
}

function displayTickets(tickets) {
    const ticketsList = document.getElementById('tixList');
    
    if (!tickets || tickets.length === 0) {
        ticketsList.innerHTML = `
            <div class="tix-empty">
                <i class="fas fa-ticket-alt"></i>
                <p>No tickets found</p>
                <span>Try adjusting your filters or create a new ticket</span>
            </div>
        `;
        return;
    }

    // Clear existing content
    ticketsList.innerHTML = '';

    // Create and append tickets one by one
    tickets.forEach(ticket => {
        const statusConfig = {
            'Open': { 
                icon: 'exclamation-circle',
                class: 'status-open',
                bgColor: '#fef2f2',
                color: '#dc2626'
            },
            'In Progress': { 
                icon: 'clock',
                class: 'status-progress',
                bgColor: '#fffbeb',
                color: '#d97706'
            },
            'Resolved': { 
                icon: 'check-circle',
                class: 'status-resolved',
                bgColor: '#ecfdf5',
                color: '#059669'
            }
        };

        const status = statusConfig[ticket.status] || statusConfig['Open'];
        
        const ticketCard = document.createElement('div');
        ticketCard.className = 'tix-item';
        
        ticketCard.innerHTML = `
            <div class="tix-item-header">
                <span class="tix-status-badge ${status.class}" style="background: ${status.bgColor}; color: ${status.color}">
                    <i class="fas fa-${status.icon}"></i>
                    ${ticket.status || 'Open'}
                </span>
                <div class="tix-actions">
                    <button class="tix-btn edit" onclick="editTicket('${ticket._id}')" title="Edit Ticket">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="tix-btn delete" onclick="deleteTicket('${ticket._id}')" title="Delete Ticket">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="tix-content">
                <h4 class="tix-client">
                    <i class="fas fa-user-circle"></i>
                    ${ticket.clientName || 'No Name'}
                </h4>
                <div class="tix-details">
                    <div class="tix-detail-item">
                        <i class="fas fa-phone"></i>
                        <span>${ticket.clientNumber || 'No Number'}</span>
                    </div>
                    <div class="tix-detail-item">
                        <i class="fas fa-home"></i>
                        <span>${ticket.houseNumber || 'No House Number'}</span>
                    </div>
                    <div class="tix-detail-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${ticket.stationLocation || 'No Location'}</span>
                    </div>
                </div>
                <div class="tix-problem-box">
                    <p>${ticket.problemDescription || 'No Description'}</p>
                </div>
            </div>
            <div class="tix-item-footer">
                <span class="tix-date">
                    <i class="fas fa-calendar-alt"></i>
                    ${new Date(ticket.reportedDateTime || Date.now()).toLocaleString()}
                </span>
                <span class="tix-category-badge cat-${(ticket.category || 'other').toLowerCase()}">
                    <i class="fas fa-tag"></i>
                    ${ticket.category || 'Other'}
                </span>
            </div>
        `;
        
        // Add animation class after a short delay
        setTimeout(() => {
            ticketCard.classList.add('show');
        }, 10);
        
        ticketsList.appendChild(ticketCard);
    });
}

// Add any global event listeners here
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => closeModal(modal.id));
    }
});

async function loadStations() {
    try {
        const response = await fetch('/api/stations');
        if (!response.ok) throw new Error('Failed to fetch stations');

        const stations = await response.json();
        populateStationSelects(stations);
    } catch (error) {
        console.error('Error loading stations:', error);
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');

        const categories = await response.json();
        populateCategorySelects(categories);
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function populateStationSelects(stations) {
    const selects = document.querySelectorAll('select[id$="Station"]');
    selects.forEach(select => {
        select.innerHTML = '<option value="">All Stations</option>';
        stations.forEach(station => {
            select.innerHTML += `<option value="${station.id}">${station.name}</option>`;
        });
    });
}

function populateCategorySelects(categories) {
    const selects = document.querySelectorAll('select[id$="category"]');
    selects.forEach(select => {
        select.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(category => {
            select.innerHTML += `<option value="${category.id}">${category.name}</option>`;
        });
    });
}

// Mobile Navigation
function initializeMobileNavigation() {
    const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if (!mobileNavToggle || !sidebar || !mainContent) {
        console.error('Mobile navigation elements not found');
        return;
    }

    // Toggle sidebar on mobile
    mobileNavToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        sidebar.classList.toggle('active');
        mainContent.classList.toggle('sidebar-active');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', function(event) {
        if (window.innerWidth <= 768) {
            const isClickInside = sidebar.contains(event.target) || 
                                mobileNavToggle.contains(event.target);
            
            if (!isClickInside && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                mainContent.classList.remove('sidebar-active');
            }
        }
    });

    // Close sidebar when clicking a navigation link
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                mainContent.classList.remove('sidebar-active');
            }
        });
    });

    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('active');
            mainContent.classList.remove('sidebar-active');
        }
    });
}

// Responsive Chart Resizing
function handleChartResize() {
    const charts = document.querySelectorAll('canvas');
    charts.forEach(chart => {
        const chartInstance = Chart.getChart(chart);
        if (chartInstance) {
            chartInstance.resize();
        }
    });
}

window.addEventListener('resize', handleChartResize);

// Responsive Table Handling
function initResponsiveTables() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
    });
}

// Initialize responsive tables when DOM is loaded
document.addEventListener('DOMContentLoaded', initResponsiveTables); 