// Global variables
let currentPage = 1;
let itemsPerPage = 9;
let allTickets = [];
let filteredTickets = [];
let categoryChart, monthlyChart, stationChart;

// DOM Elements
const elements = {
    authLoading: document.getElementById('authLoading'),
    mainContent: document.querySelector('.main-content'),
    searchInput: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    statusFilter: document.getElementById('statusFilter'),
    stationFilter: document.getElementById('stationFilter'),
    dateRangeFilter: document.getElementById('dateRangeFilter'),
    resetFilters: document.getElementById('resetFilters'),
    exportBtn: document.getElementById('exportBtn'),
    exportDateRange: document.getElementById('exportDateRange'),
    ticketsList: document.getElementById('ticketsList'),
    noTickets: document.getElementById('noTickets'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    pageInfo: document.getElementById('pageInfo'),
    newTicketBtn: document.getElementById('newTicketBtn'),
    mobileNewTicketBtn: document.getElementById('mobileNewTicketBtn'),
    ticketModal: document.getElementById('ticketModal'),
    editTicketModal: document.getElementById('editTicketModal'),
    ticketForm: document.getElementById('ticketForm'),
    editTicketForm: document.getElementById('editTicketForm'),
    customDateRangeModal: document.getElementById('customDateRangeModal'),
    customDateRange: document.getElementById('customDateRange'),
    applyDateRange: document.getElementById('applyDateRange'),
    categoryMonthSelect: document.getElementById('categoryMonthSelect'),
    stationMonthSelect: document.getElementById('stationMonthSelect'),
    pagination: document.querySelector('.pagination')
};

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check authentication
        const response = await fetch('/api/auth/check', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();
        if (!data.authenticated) {
            window.location.href = '/login.html';
            return;
        }

        // Update username
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = data.username || 'User';
        }

        // Add logout handler
        const logoutButton = document.getElementById('logout');
        if (logoutButton) {
            logoutButton.addEventListener('click', async () => {
                try {
                    const response = await fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include'
                    });
                    
                    if (response.ok) {
                        window.location.href = '/login.html';
                    } else {
                        throw new Error('Logout failed');
                    }
                } catch (error) {
                    console.error('Logout error:', error);
                    showNotification('Logout failed. Please try again.', 'error');
                }
            });
        }

        // Hide loading overlay and show content
        elements.authLoading.style.display = 'none';
        elements.mainContent.classList.add('authenticated');

        // Initialize date pickers
        initializeDatePickers();
        
        // Initialize charts
        initializeCharts();
        
        // Initialize pagination controls
        if (elements.prevPage && elements.nextPage) {
            elements.prevPage.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    displayTickets();
                }
            });

            elements.nextPage.addEventListener('click', () => {
                const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
                if (currentPage < totalPages) {
                    currentPage++;
                    displayTickets();
                }
            });
        }
        
        // Load initial data
        await loadTickets();
        
        // Setup event listeners
        setupEventListeners();
        
        // Update current date
        updateCurrentDate();

        // Apply role-based restrictions
        await checkUserRoleAndApplyRestrictions();
    } catch (error) {
        console.error('Error initializing page:', error);
        showNotification('Error loading page. Please try again.', 'error');
    }
});

// Function to check user role and apply restrictions
async function checkUserRoleAndApplyRestrictions() {
    try {
        const response = await fetch('/api/auth/check', {
            credentials: 'include'
        });
        const data = await response.json();
        
        // Hide expenses link and dashboard link by default for restricted roles
            const expensesLink = document.querySelector('a[href="expenses.html"]');
            const dashboardLink = document.querySelector('a[href="index.html"]');
        const newTicketBtn = document.getElementById('newTicketBtn');
        const mobileNewTicketBtn = document.getElementById('mobileNewTicketBtn');
        const usernameElement = document.getElementById('username');

        if (data.role === 'juniorStaff') {
            // Hide unnecessary links
            if (expensesLink) expensesLink.parentElement.style.display = 'none';
            if (dashboardLink) dashboardLink.parentElement.style.display = 'none';
            
            // Hide new ticket buttons
            if (newTicketBtn) newTicketBtn.style.display = 'none';
            if (mobileNewTicketBtn) mobileNewTicketBtn.style.display = 'none';

            // Hide delete buttons for tickets
            document.querySelectorAll('.ticket-action-btn.delete').forEach(btn => {
                btn.style.display = 'none';
            });

            // Add junior staff indicator
            if (usernameElement && !usernameElement.textContent.includes('(Junior Staff)')) {
                usernameElement.textContent = `${data.username} (Junior Staff)`;
            }
        } else if (data.role === 'staff') {
            // Existing staff restrictions
            if (expensesLink) expensesLink.parentElement.style.display = 'none';
            if (dashboardLink) dashboardLink.parentElement.style.display = 'none';

            // Add staff indicator
            if (usernameElement && !usernameElement.textContent.includes('(Staff)')) {
                usernameElement.textContent = `${data.username} (Staff)`;
            }

            // Hide delete buttons for tickets
            document.querySelectorAll('.ticket-action-btn.delete').forEach(btn => {
                btn.style.display = 'none';
            });
        } else if (data.role === 'admin') {
            if (usernameElement && !usernameElement.textContent.includes('(Admin)')) {
                usernameElement.textContent = `${data.username} (Admin)`;
            }
        } else if (data.role === 'superadmin') {
            if (usernameElement && !usernameElement.textContent.includes('(Superadmin)')) {
                usernameElement.textContent = `${data.username} (Superadmin)`;
            }
        }

        // Update the ticket display to reflect role-based permissions
        displayTickets();
    } catch (error) {
        console.error('Error checking user role:', error);
    }
}

// Initialize date pickers
function initializeDatePickers() {
    flatpickr(elements.dateRangeFilter, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        placeholder: 'Select Date Range'
    });

    flatpickr(elements.exportDateRange, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        placeholder: 'Select Export Date Range'
    });
}

// Initialize charts
function initializeCharts() {
    console.log('Initializing charts...');
    
    // Category Pie Chart
    const categoryCtx = document.getElementById('categoryPieChart');
    if (categoryCtx) {
        console.log('Initializing category chart...');
        try {
            // Clear any existing chart
            if (categoryChart) {
                categoryChart.destroy();
            }
            
    categoryChart = new Chart(categoryCtx, {
        type: 'pie',
        data: {
            labels: ['Installation', 'LOS', 'Other'],
            datasets: [{
                data: [0, 0, 0],
                        backgroundColor: ['#3498db', '#e74c3c', '#2ecc71'],
                        borderWidth: 1,
                        borderColor: '#fff'
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
                                font: {
                                    size: 12
                                }
                            }
                }
            }
        }
    });
            console.log('Category chart initialized successfully');
        } catch (error) {
            console.error('Error initializing category chart:', error);
        }
    }

    // Monthly Bar Chart
    const monthlyCtx = document.getElementById('monthlyBarChart');
    if (monthlyCtx) {
        console.log('Initializing monthly chart...');
        try {
            // Clear any existing chart
            if (monthlyChart) {
                monthlyChart.destroy();
            }
            
    monthlyChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Tickets',
                data: Array(12).fill(0),
                        backgroundColor: '#3498db',
                        borderColor: '#2980b9',
                        borderWidth: 1,
                        borderRadius: 4
            }]
        },
        options: {
            responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                font: {
                                    size: 12
                                }
                            },
                            grid: {
                                display: true,
                                drawBorder: false
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                font: {
                                    size: 12
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
            console.log('Monthly chart initialized successfully');
        } catch (error) {
            console.error('Error initializing monthly chart:', error);
        }
    }

    // Station Doughnut Chart
    const stationCtx = document.getElementById('stationDoughnutChart');
    if (stationCtx) {
        console.log('Initializing station chart...');
        try {
            // Clear any existing chart
            if (stationChart) {
                stationChart.destroy();
            }
            
    stationChart = new Chart(stationCtx, {
        type: 'doughnut',
        data: {
            labels: ['NYS GILGI', 'NYS NAIVASHA', 'MARRIEDQUARTERS', '5KRMAIN CAMP'],
            datasets: [{
                data: Array(4).fill(0),
                        backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f'],
                        borderWidth: 1,
                        borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
                    maintainAspectRatio: false,
                    cutout: '60%',
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                font: {
                                    size: 12
                                }
                            }
                        }
                    }
                }
            });
            console.log('Station chart initialized successfully');
        } catch (error) {
            console.error('Error initializing station chart:', error);
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search and filter events
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    elements.categoryFilter.addEventListener('change', handleFilters);
    elements.statusFilter.addEventListener('change', handleFilters);
    elements.stationFilter.addEventListener('change', handleFilters);
    elements.dateRangeFilter.addEventListener('change', handleFilters);
    elements.resetFilters.addEventListener('click', resetFilters);

    // Modal events
    elements.newTicketBtn.addEventListener('click', () => showModal('ticketModal'));
    elements.mobileNewTicketBtn.addEventListener('click', () => showModal('ticketModal'));
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.closest('.modal').id));
    });

    // Form submissions
    elements.ticketForm.addEventListener('submit', handleTicketSubmit);
    elements.editTicketForm.addEventListener('submit', handleTicketEdit);

    // Export button
    elements.exportBtn.addEventListener('click', handleExport);

    // Add event listener for custom date range
    elements.categoryMonthSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            showModal('customDateRangeModal');
        } else {
            updateCategoryChart();
        }
    });

    elements.stationMonthSelect.addEventListener('change', function() {
        if (this.value === 'custom') {
            showModal('customDateRangeModal');
        } else {
            updateStationChart();
        }
    });

    // Handle apply date range button
    elements.applyDateRange.addEventListener('click', function() {
        const dateRange = elements.customDateRange.value;
        if (!dateRange) {
            showNotification('Please select a date range', 'error');
        return;
    }

        // Update the appropriate chart based on which select triggered the modal
        if (elements.categoryMonthSelect.value === 'custom') {
            updateCategoryChart();
        } else if (elements.stationMonthSelect.value === 'custom') {
            updateStationChart();
        }

        closeModal('customDateRangeModal');
        elements.customDateRange.value = '';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === elements.customDateRangeModal) {
            closeModal('customDateRangeModal');
            elements.customDateRange.value = '';
        }
    });

    // Add event listener for status change
    document.getElementById('editTicketStatus').addEventListener('change', function() {
        const problemCorrectedGroup = document.getElementById('problemCorrectedGroup');
        problemCorrectedGroup.style.display = this.value === 'Resolved' ? 'block' : 'none';
    });
}

// Load tickets from API
async function loadTickets() {
    try {
        console.log('Loading tickets...');
        const response = await fetch('/api/tickets');
        if (!response.ok) throw new Error('Failed to fetch tickets');
        
        allTickets = await response.json();
        console.log('Loaded tickets:', allTickets.length);
        
        // Sort tickets: Open tickets first, then by creation time
        filteredTickets = [...allTickets].sort((a, b) => {
            if (a.status === 'Open' && b.status !== 'Open') return -1;
            if (a.status !== 'Open' && b.status === 'Open') return 1;
            return new Date(b.reportedDateTime) - new Date(a.reportedDateTime);
        });
        
        // Update stats
        updateStats();
        
        // Update charts
        updateCharts();
        
        // Display tickets
        displayTickets();
        
        // Update pagination
        updatePagination();
    } catch (error) {
        console.error('Error loading tickets:', error);
        showNotification('Error loading tickets. Please try again.', 'error');
    }
}

// Update statistics
function updateStats() {
    const stats = {
        total: filteredTickets.length,
        open: filteredTickets.filter(t => t.status === 'Open').length,
        inProgress: filteredTickets.filter(t => t.status === 'In Progress').length,
        resolved: filteredTickets.filter(t => t.status === 'Resolved').length
    };

    document.getElementById('totalTickets').textContent = stats.total;
    document.getElementById('openTickets').textContent = stats.open;
    document.getElementById('inProgressTickets').textContent = stats.inProgress;
    document.getElementById('resolvedTickets').textContent = stats.resolved;
}

// Update charts
function updateCharts() {
    console.log('Updating charts...');
    
    // Update category chart
    if (categoryChart) {
        console.log('Updating category chart...');
        try {
            const categoryData = {
                Installation: filteredTickets.filter(t => t.category?.toLowerCase() === 'installation').length,
                LOS: filteredTickets.filter(t => t.category?.toLowerCase() === 'los').length,
                Other: filteredTickets.filter(t => !['installation', 'los'].includes(t.category?.toLowerCase())).length
            };
            
            categoryChart.data.datasets[0].data = Object.values(categoryData);
            categoryChart.update();
            console.log('Category data:', categoryData);
            
            // Update legend counts
            document.getElementById('installationCount').textContent = `${categoryData.Installation} (${calculatePercentage(categoryData.Installation, Object.values(categoryData).reduce((a, b) => a + b, 0))}%)`;
            document.getElementById('losCount').textContent = `${categoryData.LOS} (${calculatePercentage(categoryData.LOS, Object.values(categoryData).reduce((a, b) => a + b, 0))}%)`;
            document.getElementById('otherCount').textContent = `${categoryData.Other} (${calculatePercentage(categoryData.Other, Object.values(categoryData).reduce((a, b) => a + b, 0))}%)`;
        } catch (error) {
            console.error('Error updating category chart:', error);
        }
    }

    // Update monthly chart
    if (monthlyChart) {
        console.log('Updating monthly chart...');
        try {
    const monthlyData = Array(12).fill(0);
            const currentYear = new Date().getFullYear();
            
    filteredTickets.forEach(ticket => {
        const date = new Date(ticket.reportedDateTime);
                if (date.getFullYear() === currentYear) {
        monthlyData[date.getMonth()]++;
                }
    });

    monthlyChart.data.datasets[0].data = monthlyData;
    monthlyChart.update();
            console.log('Monthly data:', monthlyData);
        } catch (error) {
            console.error('Error updating monthly chart:', error);
        }
    }

    // Update station chart
    if (stationChart) {
        console.log('Updating station chart...');
        try {
            const stationData = {
                'NYS GILGI': filteredTickets.filter(t => t.stationLocation === 'NYS GILGI').length,
                'NYS NAIVASHA': filteredTickets.filter(t => t.stationLocation === 'NYS NAIVASHA').length,
                'MARRIEDQUARTERS': filteredTickets.filter(t => t.stationLocation === 'MARRIEDQUARTERS').length,
                '5KRMAIN CAMP': filteredTickets.filter(t => t.stationLocation === '5KRMAIN CAMP').length
            };
            
            stationChart.data.datasets[0].data = Object.values(stationData);
            stationChart.update();
            console.log('Station data:', stationData);
        } catch (error) {
            console.error('Error updating station chart:', error);
        }
    }
}

// Helper function to calculate percentage
function calculatePercentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
}

// Display tickets in the grid
async function displayTickets() {
    try {
        console.log('Displaying tickets. Total:', filteredTickets.length);
        
        // Sort tickets: Open tickets first, then by creation time (newest first)
        const sortedTickets = [...filteredTickets].sort((a, b) => {
            if (a.status === 'Open' && b.status !== 'Open') return -1;
            if (a.status !== 'Open' && b.status === 'Open') return 1;
            return new Date(b.reportedDateTime) - new Date(a.reportedDateTime);
        });

        // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
        const pageTickets = sortedTickets.slice(startIndex, endIndex);

        // Show/hide no tickets message
        if (filteredTickets.length === 0) {
        elements.ticketsList.innerHTML = '';
        elements.noTickets.style.display = 'block';
            updatePagination(); // Still update pagination even with no tickets
        return;
    }

    elements.noTickets.style.display = 'none';

        // Get user role
        const response = await fetch('/api/auth/check', { credentials: 'include' });
        const data = await response.json();
        const userRole = data.role?.toLowerCase();
        const isJuniorStaff = userRole === 'juniorstaff';
        const isStaff = userRole === 'staff';

        // Render tickets
    elements.ticketsList.innerHTML = pageTickets.map(ticket => `
        <div class="ticket-card">
            <div class="ticket-header">
                <span class="ticket-id">#${ticket._id.slice(-6)}</span>
                <span class="ticket-status ${ticket.status.toLowerCase().replace(' ', '-')}">${ticket.status}</span>
            </div>
            <div class="ticket-body">
                <div class="ticket-client">
                    <div class="client-name">${ticket.clientName}</div>
                    <div class="client-details">
                        <div class="client-detail-item">
                            <i class="fas fa-phone"></i>
                            <a href="tel:${ticket.clientNumber}" class="phone-link">
                                <span>${ticket.clientNumber}</span>
                            </a>
                        </div>
                        <div class="client-detail-item">
                            <i class="fas fa-map-marker-alt"></i>
                                ${ticket.stationLocation}
                        </div>
                        <div class="client-detail-item">
                            <i class="fas fa-home"></i>
                                ${ticket.houseNumber}
                        </div>
                    </div>
                </div>
                    <span class="ticket-category ${ticket.category.toLowerCase().replace(/\s+/g, '-')}">${ticket.category}</span>
                <div class="ticket-description">
                        <strong>Problem:</strong>
                        ${ticket.problemDescription}
                </div>
                ${ticket.problemCorrected ? `
                <div class="ticket-solution">
                        <strong>Solution:</strong>
                        ${ticket.problemCorrected}
                </div>
                ` : ''}
            </div>
            <div class="ticket-footer">
                    <span class="ticket-date">
                        <i class="far fa-clock"></i>
                        ${formatDate(ticket.reportedDateTime)}
                    </span>
                <div class="ticket-actions">
                        <button class="ticket-action-btn edit" onclick="openEditModal('${ticket._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                        ${(!isJuniorStaff && !isStaff) ? `
                    <button class="ticket-action-btn delete" onclick="deleteTicket('${ticket._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                        ` : ''}
                </div>
            </div>
        </div>
    `).join('');

        // Update pagination after displaying tickets
        updatePagination();
        
    } catch (error) {
        console.error('Error displaying tickets:', error);
        showNotification('Error displaying tickets. Please refresh the page.', 'error');
    }
}

// Handle search
function handleSearch() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    filteredTickets = allTickets.filter(ticket => 
        ticket.clientName.toLowerCase().includes(searchTerm) ||
        ticket.clientNumber.toLowerCase().includes(searchTerm) ||
        ticket.houseNumber.toLowerCase().includes(searchTerm) ||
        ticket.stationLocation.toLowerCase().includes(searchTerm) ||
        ticket.problemDescription.toLowerCase().includes(searchTerm)
    );
    currentPage = 1;
    displayTickets();
    updatePagination();
}

// Handle filters
function handleFilters() {
    const category = elements.categoryFilter.value;
    const status = elements.statusFilter.value;
    const station = elements.stationFilter.value;
    const dateRange = elements.dateRangeFilter.value;

    filteredTickets = allTickets.filter(ticket => {
        const matchesCategory = category === 'All Categories' || ticket.category === category;
        const matchesStatus = status === 'All Statuses' || ticket.status === status;
        const matchesStation = station === 'All Stations' || ticket.stationLocation === station;
        
        let matchesDate = true;
        if (dateRange) {
            const [startDate, endDate] = dateRange.split(' to ').map(d => new Date(d));
            const ticketDate = new Date(ticket.reportedDateTime);
            matchesDate = ticketDate >= startDate && ticketDate <= endDate;
        }

        return matchesCategory && matchesStatus && matchesStation && matchesDate;
    });

    currentPage = 1;
    displayTickets();
    updatePagination();
    updateStats();
    updateCharts();
}

// Reset filters
function resetFilters() {
    elements.searchInput.value = '';
    elements.categoryFilter.value = 'All Categories';
    elements.statusFilter.value = 'All Statuses';
    elements.stationFilter.value = 'All Stations';
    elements.dateRangeFilter.value = '';
    
    filteredTickets = [...allTickets];
    currentPage = 1;
    displayTickets();
    updatePagination();
    updateStats();
    updateCharts();
}

// Handle ticket submission
async function handleTicketSubmit(e) {
    e.preventDefault();
    
    // Get the submit button and disable it
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    }
    
    const formData = {
        clientName: document.getElementById('clientName').value,
        clientNumber: document.getElementById('clientNumber').value,
        stationLocation: document.getElementById('station').value,
        houseNumber: document.getElementById('houseNumber').value,
        category: document.getElementById('category').value,
        reportedDateTime: document.getElementById('dateReported').value,
        problemDescription: document.getElementById('description').value,
        status: 'Open'
    };

    try {
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.details || 'Failed to create ticket');
        }

        allTickets.unshift(data);
        filteredTickets = [...allTickets];
        
        closeModal('ticketModal');
        elements.ticketForm.reset();
        
        displayTickets();
        updatePagination();
        updateStats();
        updateCharts();
        
        showNotification('Ticket created successfully!');
    } catch (error) {
        console.error('Error creating ticket:', error);
        showNotification(error.message || 'Error creating ticket. Please try again.', 'error');
    } finally {
        // Re-enable the submit button and restore its original text
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Create Ticket';
        }
    }
}

// Handle ticket edit
async function handleTicketEdit(e) {
    e.preventDefault();
    
    const ticketId = document.getElementById('editTicketId').value;
    const status = document.getElementById('editTicketStatus').value;
    const problemCorrected = document.getElementById('problemCorrected')?.value || '';

    const updateData = {
        status,
        problemCorrected: status === 'Resolved' ? problemCorrected : undefined
    };

    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update ticket');
        }

        const updatedTicket = await response.json();
        
        // Update the ticket in our arrays
        const index = allTickets.findIndex(t => t._id === ticketId);
        if (index !== -1) {
            allTickets[index] = updatedTicket;
            filteredTickets = filteredTickets.map(t => 
                t._id === ticketId ? updatedTicket : t
            );
        }

        closeModal('editTicketModal');
        document.getElementById('editTicketForm').reset();
        
        displayTickets();
        updateStats();
        updateCharts();
        
        showNotification('Ticket updated successfully!');
    } catch (error) {
        console.error('Error updating ticket:', error);
        showNotification(error.message || 'Error updating ticket. Please try again.', 'error');
    }
}

// Edit ticket
async function openEditModal(ticketId) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}`);
        if (!response.ok) throw new Error('Failed to fetch ticket');

        const ticket = await response.json();
        
        // Set form values
        document.getElementById('editTicketId').value = ticket._id;
        document.getElementById('editTicketStatus').value = ticket.status;
        
        // Show/hide problem corrected field based on status
        const problemCorrectedGroup = document.getElementById('problemCorrectedGroup');
        if (problemCorrectedGroup) {
        problemCorrectedGroup.style.display = ticket.status === 'Resolved' ? 'block' : 'none';
            if (ticket.status === 'Resolved') {
                document.getElementById('problemCorrected').value = ticket.problemCorrected || '';
            }
        }
        
        // Show the modal
        showModal('editTicketModal');
    } catch (error) {
        console.error('Error fetching ticket:', error);
        showNotification('Error fetching ticket details. Please try again.', 'error');
    }
}

// Delete ticket
async function deleteTicket(ticketId) {
    if (!confirm('Are you sure you want to delete this ticket?')) return;

    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete ticket');

        allTickets = allTickets.filter(t => t._id !== ticketId);
        filteredTickets = [...allTickets];
        
        displayTickets();
        updatePagination();
        updateStats();
        updateCharts();
        
        showNotification('Ticket deleted successfully!');
    } catch (error) {
        console.error('Error deleting ticket:', error);
        showNotification('Error deleting ticket. Please try again.', 'error');
    }
}

// Handle export
async function handleExport() {
    const dateRange = elements.exportDateRange.value;
    const station = elements.stationFilter.value;
        
    if (!dateRange) {
        showNotification('Please select a date range for export', 'error');
            return;
        }

    try {
        const [startDate, endDate] = dateRange.split(' to ');
        const response = await fetch(`/api/tickets/export?startDate=${startDate}&endDate=${endDate}&station=${encodeURIComponent(station)}`);
        
        if (!response.ok) throw new Error('Failed to export tickets');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tickets-${startDate}-to-${endDate}${station !== 'All Stations' ? `-${station}` : ''}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showNotification('Tickets exported successfully!');
    } catch (error) {
        console.error('Error exporting tickets:', error);
        showNotification('Error exporting tickets. Please try again.', 'error');
    }
}

// Utility functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleString();
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

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

function updateCurrentDate() {
    const date = new Date();
    document.getElementById('currentDate').textContent = date.toLocaleDateString();
}

function updatePagination() {
    if (!elements.pagination || !elements.pageInfo || !elements.prevPage || !elements.nextPage) {
        console.error('Pagination elements not found');
        return;
    }

    const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage));
    currentPage = Math.min(currentPage, totalPages); // Ensure current page is valid
    
    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    elements.prevPage.disabled = currentPage === 1;
    elements.nextPage.disabled = currentPage === totalPages;

    // Always show pagination controls, even with one page
    elements.pagination.style.display = 'flex';
}

function changePage(page) {
    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayTickets();
    
    // Scroll to top of tickets section
    elements.ticketsList.scrollIntoView({ behavior: 'smooth' });
}

// Update category chart based on selected time period
function updateCategoryChart() {
    if (!categoryChart) return;

    const timePeriod = elements.categoryMonthSelect.value;
    const now = new Date();
    let startDate, endDate;

    if (timePeriod === 'custom') {
        const dateRange = elements.customDateRange.value;
        if (!dateRange) {
            showNotification('Please select a date range', 'error');
            return;
        }
        [startDate, endDate] = dateRange.split(' to ').map(d => new Date(d));
    } else {
        switch(timePeriod) {
            case 'current':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
                break;
            case 'last':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'last3':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                endDate = now;
                break;
            case 'last6':
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                endDate = now;
                break;
            case 'last12':
                startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
                endDate = now;
                break;
        }
    }

    // Filter tickets based on date range
    const filteredTicketsByDate = filteredTickets.filter(ticket => {
        const ticketDate = new Date(ticket.reportedDateTime);
        return ticketDate >= startDate && ticketDate <= endDate;
    });

    // Calculate category counts (case-insensitive)
    const categoryData = {
        Installation: filteredTicketsByDate.filter(t => t.category?.toLowerCase() === 'installation').length,
        LOS: filteredTicketsByDate.filter(t => t.category?.toLowerCase() === 'los').length,
        Other: filteredTicketsByDate.filter(t => !['installation', 'los'].includes(t.category?.toLowerCase())).length
    };

    // Update chart data
    categoryChart.data.datasets[0].data = Object.values(categoryData);
    categoryChart.update('none'); // Use 'none' mode for better performance

    // Update legend counts
    document.getElementById('installationCount').textContent = categoryData.Installation;
    document.getElementById('losCount').textContent = categoryData.LOS;
    document.getElementById('otherCount').textContent = categoryData.Other;

    // Calculate and display performance metrics
    const totalTickets = Object.values(categoryData).reduce((a, b) => a + b, 0);
    if (totalTickets > 0) {
        const performanceMetrics = {
            Installation: ((categoryData.Installation / totalTickets) * 100).toFixed(1),
            LOS: ((categoryData.LOS / totalTickets) * 100).toFixed(1),
            Other: ((categoryData.Other / totalTickets) * 100).toFixed(1)
        };

        // Update legend with percentages
        document.querySelectorAll('.legend-item').forEach(item => {
            const category = item.querySelector('span:nth-child(2)').textContent;
            const count = item.querySelector('.legend-count');
            count.textContent = `${categoryData[category]} (${performanceMetrics[category]}%)`;
        });
    } else {
        // Reset counts if no data
        document.querySelectorAll('.legend-count').forEach(count => {
            count.textContent = '0 (0%)';
        });
    }
}

// Initialize date picker for custom date range
function initializeCustomDatePicker() {
    flatpickr(elements.customDateRange, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        placeholder: 'Select custom date range'
    });
}

// Update the updateStationChart function
function updateStationChart() {
    if (!stationChart) return;

    const timePeriod = elements.stationMonthSelect.value;
    const now = new Date();
    let startDate, endDate;

    if (timePeriod === 'custom') {
        const dateRange = elements.customDateRange.value;
        if (!dateRange) return;
        [startDate, endDate] = dateRange.split(' to ').map(d => new Date(d));
    } else {
        switch(timePeriod) {
            case 'current':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
                break;
            case 'last':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'last3':
                startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                endDate = now;
                break;
            case 'last6':
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                endDate = now;
                break;
            case 'last12':
                startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
                endDate = now;
                break;
        }
    }

    // Filter tickets based on date range
    const filteredTicketsByDate = filteredTickets.filter(ticket => {
        const ticketDate = new Date(ticket.reportedDateTime);
        return ticketDate >= startDate && ticketDate <= endDate;
    });

    // Calculate station distribution
    const stationData = {
        'NYS GILGI': filteredTicketsByDate.filter(t => t.stationLocation === 'NYS GILGI').length,
        'NYS NAIVASHA': filteredTicketsByDate.filter(t => t.stationLocation === 'NYS NAIVASHA').length,
        'MARRIEDQUARTERS': filteredTicketsByDate.filter(t => t.stationLocation === 'MARRIEDQUARTERS').length,
        '5KRMAIN CAMP': filteredTicketsByDate.filter(t => t.stationLocation === '5KRMAIN CAMP').length
    };

    // Update chart data
    stationChart.data.datasets[0].data = Object.values(stationData);
    stationChart.update('none'); // Use 'none' mode for better performance
} 