// Global variables
let currentPage = 1;
let itemsPerPage = 10;
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
    stationMonthSelect: document.getElementById('stationMonthSelect')
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
        
        if (data.role === 'staff') {
            // Hide expenses link
            const expensesLink = document.querySelector('a[href="expenses.html"]');
            if (expensesLink) {
                expensesLink.parentElement.style.display = 'none';
            }

            // Hide dashboard link
            const dashboardLink = document.querySelector('a[href="index.html"]');
            if (dashboardLink) {
                dashboardLink.parentElement.style.display = 'none';
            }

            // Add staff indicator
            const usernameElement = document.getElementById('username');
            if (usernameElement && !usernameElement.textContent.includes('(Staff)')) {
                usernameElement.textContent = `${usernameElement.textContent} (Staff)`;
            }

            // Hide delete buttons for tickets
            document.querySelectorAll('.ticket-action-btn.delete').forEach(btn => {
                btn.style.display = 'none';
            });
        }
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
    // Category Pie Chart
    const categoryCtx = document.getElementById('categoryPieChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'pie',
        data: {
            labels: ['Installation', 'LOS', 'Other'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#3498db', '#e74c3c', '#2ecc71']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    // Add event listener for month selection
    document.getElementById('categoryMonthSelect').addEventListener('change', updateCategoryChart);

    // Monthly Bar Chart
    const monthlyCtx = document.getElementById('monthlyBarChart').getContext('2d');
    monthlyChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Tickets',
                data: Array(12).fill(0),
                backgroundColor: '#3498db'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Station Doughnut Chart
    const stationCtx = document.getElementById('stationDoughnutChart').getContext('2d');
    stationChart = new Chart(stationCtx, {
        type: 'doughnut',
        data: {
            labels: ['NYS GILGI', 'NYS NAIVASHA', 'MARRIEDQUARTERS', '5KRMAIN CAMP'],
            datasets: [{
                data: Array(4).fill(0),
                backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f1c40f']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Initialize custom date picker
    initializeCustomDatePicker();
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

    // Pagination events
    elements.prevPage.addEventListener('click', () => changePage(currentPage - 1));
    elements.nextPage.addEventListener('click', () => changePage(currentPage + 1));

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
        const response = await fetch('/api/tickets');
        if (!response.ok) throw new Error('Failed to fetch tickets');
        
        allTickets = await response.json();
        filteredTickets = [...allTickets];
        
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
    updateCategoryChart();
    updateStationChart();

    // Monthly distribution
    const monthlyData = Array(12).fill(0);
    filteredTickets.forEach(ticket => {
        const date = new Date(ticket.reportedDateTime);
        monthlyData[date.getMonth()]++;
    });

    monthlyChart.data.datasets[0].data = monthlyData;
    monthlyChart.update();
}

// Display tickets in the grid
function displayTickets() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageTickets = filteredTickets.slice(startIndex, endIndex);

    if (pageTickets.length === 0) {
        elements.ticketsList.innerHTML = '';
        elements.noTickets.style.display = 'block';
        return;
    }

    elements.noTickets.style.display = 'none';
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
                            <span>${ticket.clientNumber}</span>
                        </div>
                        <div class="client-detail-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${ticket.stationLocation}</span>
                        </div>
                        <div class="client-detail-item">
                            <i class="fas fa-home"></i>
                            <span>${ticket.houseNumber}</span>
                        </div>
                    </div>
                </div>
                <div class="ticket-category">
                    <i class="fas fa-tag"></i> ${ticket.category}
                </div>
                <div class="ticket-description">
                    <strong>Problem:</strong> ${ticket.problemDescription}
                </div>
                ${ticket.problemCorrected ? `
                <div class="ticket-solution">
                    <strong>Solution:</strong> ${ticket.problemCorrected}
                </div>
                ` : ''}
            </div>
            <div class="ticket-footer">
                <div class="ticket-date">
                    <i class="far fa-clock"></i> ${formatDate(ticket.reportedDateTime)}
                </div>
                <div class="ticket-actions">
                    <button class="ticket-action-btn edit" onclick="editTicket('${ticket._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="ticket-action-btn delete" onclick="deleteTicket('${ticket._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
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

        if (!response.ok) throw new Error('Failed to create ticket');

        const newTicket = await response.json();
        allTickets.unshift(newTicket);
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
        showNotification('Error creating ticket. Please try again.', 'error');
    }
}

// Handle ticket edit
async function handleTicketEdit(e) {
    e.preventDefault();
    
    const ticketId = document.getElementById('editTicketId').value;
    const status = document.getElementById('editTicketStatus').value;
    const problemCorrected = document.getElementById('problemCorrected').value;

    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                status,
                problemCorrected: status === 'Resolved' ? problemCorrected : undefined
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update ticket');
        }

        const updatedTicket = await response.json();
        const index = allTickets.findIndex(t => t._id === ticketId);
        if (index !== -1) {
            allTickets[index] = updatedTicket;
            filteredTickets = [...allTickets];
        }

        closeModal('editTicketModal');
        elements.editTicketForm.reset();
        
        displayTickets();
        updatePagination();
        updateStats();
        updateCharts();
        
        showNotification('Ticket updated successfully!');
    } catch (error) {
        console.error('Error updating ticket:', error);
        showNotification(error.message || 'Error updating ticket. Please try again.', 'error');
    }
}

// Edit ticket
async function editTicket(ticketId) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}`);
        if (!response.ok) throw new Error('Failed to fetch ticket');

        const ticket = await response.json();
        document.getElementById('editTicketId').value = ticket._id;
        document.getElementById('editTicketStatus').value = ticket.status;
        document.getElementById('problemCorrected').value = ticket.problemCorrected || '';
        
        // Show/hide problem corrected field based on status
        const problemCorrectedGroup = document.getElementById('problemCorrectedGroup');
        problemCorrectedGroup.style.display = ticket.status === 'Resolved' ? 'block' : 'none';
        
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
    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    elements.prevPage.disabled = currentPage === 1;
    elements.nextPage.disabled = currentPage === totalPages;
    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

function changePage(page) {
    const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    displayTickets();
    updatePagination();
}

// Update category chart based on selected time period
function updateCategoryChart() {
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

    // Calculate category counts
    const categoryData = {
        Installation: filteredTicketsByDate.filter(t => t.category === 'Installation').length,
        LOS: filteredTicketsByDate.filter(t => t.category === 'LOS').length,
        Other: filteredTicketsByDate.filter(t => t.category === 'Other').length
    };

    // Update chart data
    categoryChart.data.datasets[0].data = Object.values(categoryData);
    categoryChart.update();

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
    stationChart.update();
} 