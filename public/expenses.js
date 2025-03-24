// Global variables
let categoryPieChart = null;
let monthlyBarChart = null;
let trendLineChart = null;
let currentExpenseId = null;

// DOM Elements
const elements = {
    authLoading: document.getElementById('authLoading'),
    mainContent: document.querySelector('.main-content'),
    searchInput: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    paymentMethodFilter: document.getElementById('paymentMethodFilter'),
    dateRangeFilter: document.getElementById('dateRangeFilter'),
    resetFilters: document.getElementById('resetFilters'),
    exportBtn: document.getElementById('exportBtn'),
    exportDateRange: document.getElementById('exportDateRange'),
    expensesList: document.getElementById('expensesList'),
    noExpenses: document.getElementById('noExpenses'),
    newExpenseBtn: document.getElementById('newExpenseBtn'),
    mobileNewExpenseBtn: document.getElementById('mobileNewExpenseBtn'),
    expenseModal: document.getElementById('expenseModal'),
    expenseForm: document.getElementById('expenseForm')
};

// Immediately check authentication when script loads
document.addEventListener('DOMContentLoaded', async function() {
    try {
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
            usernameElement.textContent = data.username;
        }

        // Show the main content
        elements.mainContent.classList.add('authenticated');
        
        // Hide loading overlay
        elements.authLoading.style.display = 'none';

        // Initialize the page
        initializePage();
    } catch (error) {
        console.error('Authentication error:', error);
        window.location.href = '/login.html';
    }
});

// Function to initialize the page
function initializePage() {
    // Initialize Flatpickr for date inputs
    flatpickr("#expenseDate", {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        defaultDate: null,
        time_24hr: true,
        placeholder: 'Select date and time',
        allowInput: true
    });

    // Initialize date range picker for filters
    flatpickr("#dateRangeFilter", {
        mode: "range",
        dateFormat: "Y-m-d",
        placeholder: "Select Date Range",
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                loadExpenses();
            }
        }
    });

    // Initialize date range picker for export
    flatpickr("#exportDateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        placeholder: "Select Export Date Range"
    });

    // Initialize charts
    initializeCharts();

    // Load initial data
    loadExpenses();

    // Add event listeners
    document.getElementById('expenseForm').addEventListener('submit', handleExpenseSubmit);
    document.getElementById('newExpenseBtn').addEventListener('click', () => openModal());
    document.getElementById('mobileNewExpenseBtn').addEventListener('click', () => openModal());
    document.getElementById('categoryFilter').addEventListener('change', loadExpenses);
    document.getElementById('paymentMethodFilter').addEventListener('change', loadExpenses);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('searchInput').addEventListener('input', debounce(loadExpenses, 300));
    document.getElementById('exportBtn').addEventListener('click', handleExport);

    // Close modal handlers
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', closeModal);
    });

    // Update current date
    updateCurrentDate();

    // Add logout handler
    document.getElementById('logout').addEventListener('click', handleLogout);

    // Add refresh handlers for charts
    document.querySelectorAll('.refresh-chart').forEach(button => {
        button.addEventListener('click', loadExpenses);
    });
}

// Initialize Charts
function initializeCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom'
            }
        }
    };

    // Category Pie Chart
    const pieCtx = document.getElementById('categoryPieChart').getContext('2d');
    categoryPieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0'
                ]
            }]
        },
        options: chartOptions
    });

    // Monthly Bar Chart
    const barCtx = document.getElementById('monthlyBarChart').getContext('2d');
    monthlyBarChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Monthly Expenses',
                data: [],
                backgroundColor: '#36A2EB'
            }]
        },
        options: {
            ...chartOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `KES ${value.toLocaleString()}`
                    }
                }
            }
        }
    });

    // Trend Line Chart
    const lineCtx = document.getElementById('trendLineChart').getContext('2d');
    trendLineChart = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Expense Trend',
                data: [],
                borderColor: '#4BC0C0',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            ...chartOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => `KES ${value.toLocaleString()}`
                    }
                }
            }
        }
    });
}

// Handle form submission
async function handleExpenseSubmit(e) {
    e.preventDefault();
    
    const expenseData = {
        name: document.getElementById('expenseName').value.trim(),
        category: document.getElementById('expenseCategory').value,
        amount: parseFloat(document.getElementById('expenseAmount').value),
        date: document.getElementById('expenseDate').value,
        description: document.getElementById('expenseNotes').value.trim(),
        paymentMethod: document.getElementById('paymentMethod').value
    };

    // Validate form
    if (!validateExpenseForm(expenseData)) {
        return;
    }

    try {
        const url = currentExpenseId ? `/api/expenses/${currentExpenseId}` : '/api/expenses';
        const method = currentExpenseId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(expenseData),
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save expense');
        }

        const savedExpense = await response.json();
        
        // Close modal first to prevent UI jank
        closeModal();
        
        // Show success notification
        showNotification(currentExpenseId ? 'Expense updated successfully' : 'Expense added successfully');

        // Update UI with new/updated expense
        const expensesList = document.getElementById('expensesList');
        const noExpenses = document.getElementById('noExpenses');
        const existingCard = document.querySelector(`.expense-card[data-expense-id="${savedExpense._id}"]`);

        if (noExpenses) {
            noExpenses.style.display = 'none';
        }

        const card = document.createElement('div');
        card.className = 'expense-card';
        card.dataset.expenseId = savedExpense._id;
        card.innerHTML = `
            <div class="expense-header">
                <h3>${savedExpense.name}</h3>
                <span class="category-badge ${savedExpense.category.toLowerCase()}">${savedExpense.category}</span>
            </div>
            <div class="expense-details">
                <div class="amount">
                    <i class="fas fa-money-bill-wave"></i>
                    KES ${savedExpense.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                <div>
                    <i class="fas fa-calendar"></i>
                    ${formatDate(savedExpense.date)}
                </div>
                <div>
                    <i class="fas fa-credit-card"></i>
                    ${savedExpense.paymentMethod}
                </div>
            </div>
            ${savedExpense.description ? `
                <div class="expense-notes">
                    <i class="fas fa-sticky-note"></i> ${savedExpense.description}
                </div>
            ` : ''}
            <div class="expense-actions">
                <button class="btn-icon" onclick="openModal('${savedExpense._id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete" onclick="deleteExpense('${savedExpense._id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        if (existingCard) {
            // Update existing card with animation
            existingCard.style.transition = 'opacity 0.3s ease-out';
            existingCard.style.opacity = '0';
            setTimeout(() => {
                existingCard.replaceWith(card);
                setTimeout(() => {
                    card.style.opacity = '1';
                }, 50);
            }, 300);
        } else {
            // Add new card at the beginning with animation
            card.style.opacity = '0';
            if (expensesList.firstChild) {
                expensesList.insertBefore(card, expensesList.firstChild);
            } else {
                expensesList.appendChild(card);
            }
            setTimeout(() => {
                card.style.transition = 'opacity 0.3s ease-in';
                card.style.opacity = '1';
            }, 50);
        }

        // Reload expenses to update charts and totals
        loadExpenses();

    } catch (error) {
        console.error('Error saving expense:', error);
        showNotification(error.message, 'error');
    }
}

// Load and display expenses
async function loadExpenses() {
    try {
        const expensesList = document.getElementById('expensesList');
        const noExpenses = document.getElementById('noExpenses');
        
        // Show loading state
        expensesList.innerHTML = '<div class="loading">Loading expenses...</div>';

        // Fetch expenses from server
        const response = await fetch('/api/expenses', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch expenses');
        }

        let expenses = await response.json();
        console.log('Fetched expenses:', expenses); // Debug log

        // Apply filters
        expenses = filterExpenses(expenses);
        console.log('Filtered expenses:', expenses); // Debug log

        // Sort expenses by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Clear existing content
        expensesList.innerHTML = '';

        if (expenses.length === 0) {
            noExpenses.style.display = 'block';
            updateCharts([]);
            updateTotals([]);
            return;
        }

        noExpenses.style.display = 'none';

        // Display expenses as cards
        expenses.forEach(expense => {
            const card = document.createElement('div');
            card.className = 'expense-card';
            card.dataset.expenseId = expense._id;
            card.innerHTML = `
                <div class="expense-header">
                    <h3>${expense.name}</h3>
                    <span class="category-badge ${expense.category.toLowerCase()}">${expense.category}</span>
                </div>
                <div class="expense-details">
                    <div class="amount">
                        <i class="fas fa-money-bill-wave"></i>
                        KES ${expense.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                    <div>
                        <i class="fas fa-calendar"></i>
                        ${formatDate(expense.date)}
                    </div>
                    <div>
                        <i class="fas fa-credit-card"></i>
                        ${expense.paymentMethod}
                    </div>
                </div>
                ${expense.description ? `
                    <div class="expense-notes">
                        <i class="fas fa-sticky-note"></i> ${expense.description}
                    </div>
                ` : ''}
                <div class="expense-actions">
                    <button class="btn-icon" onclick="openModal('${expense._id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteExpense('${expense._id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            expensesList.appendChild(card);
        });

        // Update charts and totals
        updateCharts(expenses);
        updateTotals(expenses);
    } catch (error) {
        console.error('Error loading expenses:', error);
        expensesList.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load expenses</p>
                <button onclick="loadExpenses()" class="retry-btn">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
        showNotification('Failed to load expenses: ' + error.message, 'error');
    }
}

// Filter expenses
function filterExpenses(expenses) {
    const categoryFilter = document.getElementById('categoryFilter').value;
    const paymentMethodFilter = document.getElementById('paymentMethodFilter').value;
    const dateRange = document.getElementById('dateRangeFilter').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();

    return expenses.filter(expense => {
        // Category filter
        if (categoryFilter && categoryFilter !== 'All Categories' && expense.category !== categoryFilter) {
            return false;
        }

        // Payment method filter
        if (paymentMethodFilter && paymentMethodFilter !== 'All Payment Methods' && expense.paymentMethod !== paymentMethodFilter) {
            return false;
        }
        
        // Date range filter
        if (dateRange) {
            const [startStr, endStr] = dateRange.split(' to ');
            if (startStr && endStr) {
                const startDate = new Date(startStr);
                const endDate = new Date(endStr);
                const expenseDate = new Date(expense.date);
                
                // Set time to midnight for accurate date comparison
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
                expenseDate.setHours(12, 0, 0, 0);

                if (expenseDate < startDate || expenseDate > endDate) {
                    return false;
                }
            }
        }

        // Search query
        if (searchQuery) {
            const searchFields = [
                expense.name,
                expense.category,
                expense.paymentMethod,
                expense.description,
                formatCurrency(expense.amount)
            ].map(field => (field || '').toLowerCase());

            return searchFields.some(field => field.includes(searchQuery));
        }

        return true;
    });
}

// Reset filters
function resetFilters() {
    // Reset all filter inputs
    document.getElementById('categoryFilter').value = 'All Categories';
    document.getElementById('paymentMethodFilter').value = 'All Payment Methods';
    document.getElementById('dateRangeFilter').value = '';
    document.getElementById('searchInput').value = '';

    // Clear any flatpickr instance
    const dateRangePicker = document.getElementById('dateRangeFilter')._flatpickr;
    if (dateRangePicker) {
        dateRangePicker.clear();
    }

    // Reload expenses with cleared filters
    loadExpenses();

    // Show notification
    showNotification('Filters have been reset');
}

// Update charts
function updateCharts(filteredExpenses) {
    // Get current month's expenses for pie chart
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    const currentMonthExpenses = filteredExpenses.filter(expense => 
        expense.date.startsWith(currentMonth)
    );

    // Update Category Pie Chart with only current month's data
    const categoryData = {};
    currentMonthExpenses.forEach(expense => {
        categoryData[expense.category] = (categoryData[expense.category] || 0) + expense.amount;
    });

    categoryPieChart.data.labels = Object.keys(categoryData);
    categoryPieChart.data.datasets[0].data = Object.values(categoryData);
    categoryPieChart.options.plugins.title.text = `Expense Categories - ${moment(currentMonth).format('MMMM YYYY')}`;
    categoryPieChart.update();

    // Update Monthly Bar Chart
    const monthlyData = {};
    filteredExpenses.forEach(expense => {
        const month = expense.date.substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + expense.amount;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    monthlyBarChart.data.labels = sortedMonths.map(m => moment(m).format('MMM YYYY'));
    monthlyBarChart.data.datasets[0].data = sortedMonths.map(m => monthlyData[m]);
    monthlyBarChart.update();

    // Update Trend Line Chart with yearly data
    const yearlyData = {};
    const years = new Set();
    
    // Get all unique years from expenses
    filteredExpenses.forEach(expense => {
        const year = new Date(expense.date).getFullYear();
        years.add(year);
    });

    // Sort years in ascending order
    const sortedYears = Array.from(years).sort();
    
    // Initialize data structure for all months in each year
    sortedYears.forEach(year => {
        for (let month = 0; month < 12; month++) {
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            yearlyData[monthKey] = 0;
        }
    });

    // Fill in actual expense data
    filteredExpenses.forEach(expense => {
        const date = new Date(expense.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        yearlyData[monthKey] = (yearlyData[monthKey] || 0) + expense.amount;
    });

    // Create datasets for each year
    const datasets = sortedYears.map(year => ({
        label: `${year}`,
        data: Array.from({ length: 12 }, (_, month) => {
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            return yearlyData[monthKey] || 0;
        }),
        borderColor: getRandomColor(),
        fill: false,
        tension: 0.4
    }));

    // Update trend line chart
    trendLineChart.data.labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    trendLineChart.data.datasets = datasets;
    trendLineChart.options.plugins.title = {
        display: true,
        text: 'Yearly Expense Trends',
        font: { size: 16 }
    };
    trendLineChart.options.scales = {
        y: {
            beginAtZero: true,
            ticks: {
                callback: value => `KES ${value.toLocaleString()}`
            }
        }
    };
    trendLineChart.update();
}

// Helper function to generate random colors for chart lines
function getRandomColor() {
    const colors = [
        '#FF6384', // Red
        '#36A2EB', // Blue
        '#FFCE56', // Yellow
        '#4BC0C0', // Teal
        '#9966FF', // Purple
        '#FF9F40', // Orange
        '#FF6384', // Pink
        '#C9CBCF'  // Gray
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Update totals
function updateTotals(filteredExpenses) {
    // Calculate total amount
    const total = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    document.getElementById('totalAmount').textContent = formatCurrency(total);

    // Calculate monthly total
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthlyTotal = filteredExpenses
        .filter(e => e.date.startsWith(currentMonth))
        .reduce((sum, expense) => sum + expense.amount, 0);
    document.getElementById('monthlyAmount').textContent = formatCurrency(monthlyTotal);

    // Count unique categories
    const uniqueCategories = new Set(filteredExpenses.map(e => e.category)).size;
    document.getElementById('categoryCount').textContent = uniqueCategories;

    // Calculate daily average
    const dates = new Set(filteredExpenses.map(e => e.date));
    const dailyAverage = dates.size > 0 ? total / dates.size : 0;
    document.getElementById('dailyAverage').textContent = formatCurrency(dailyAverage);
}

// Modal functions
async function openModal(expenseId = null) {
    currentExpenseId = expenseId;
    const modal = document.getElementById('expenseModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const form = document.getElementById('expenseForm');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Reset form and clear any previous validation states
    form.reset();
    
    // Get the date picker instance
    const datePicker = form.expenseDate._flatpickr;
    
    if (expenseId) {
        try {
            const response = await fetch(`/api/expenses/${expenseId}`, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch expense details');
            }

            const expense = await response.json();
            
            // Update modal title and button text
            modalTitle.textContent = 'Edit Expense';
            submitBtn.textContent = 'Update Expense';
            
            // Populate form fields
            form.expenseName.value = expense.name;
            form.expenseCategory.value = expense.category;
            form.expenseAmount.value = expense.amount;
            form.paymentMethod.value = expense.paymentMethod;
            form.expenseNotes.value = expense.description || '';
            
            // Set the date in the date picker for editing
            if (datePicker) {
                datePicker.setDate(new Date(expense.date), true);
            }
        } catch (error) {
            console.error('Error fetching expense:', error);
            showNotification('Error fetching expense details', 'error');
            return;
        }
    } else {
        // New expense - clear the date field
        modalTitle.textContent = 'Add New Expense';
        submitBtn.textContent = 'Save Expense';
        
        // Clear the date field for new expense
        if (datePicker) {
            datePicker.clear();
        }
    }

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Focus on the first input
    form.expenseName.focus();
}

function closeModal() {
    const modal = document.getElementById('expenseModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    currentExpenseId = null;
    
    // Reset form and clear any validation states
    const form = document.getElementById('expenseForm');
    form.reset();
    
    // Clear the date picker
    const datePicker = form.expenseDate._flatpickr;
    if (datePicker) {
        datePicker.clear();
    }
}

// Delete expense
async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) {
        return;
    }

    try {
        const response = await fetch(`/api/expenses/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete expense');
        }

        await response.json(); // Read the response

        // Find and remove the expense card with animation
        const expenseCard = document.querySelector(`.expense-card[data-expense-id="${id}"]`);
        if (expenseCard) {
            // Add fade-out animation
            expenseCard.style.transition = 'opacity 0.3s ease-out';
            expenseCard.style.opacity = '0';
            
            // Remove the card after animation
            setTimeout(() => {
                expenseCard.remove();
                
                // Check if there are any remaining expenses
                const expensesList = document.getElementById('expensesList');
                const noExpenses = document.getElementById('noExpenses');
                
                if (expensesList.children.length === 0) {
                    if (noExpenses) {
                        noExpenses.style.display = 'block';
                    }
                }
            }, 300);
        }

        // Show success notification
        showNotification('Expense deleted successfully');

        // Fetch updated expenses for charts and totals
        const allExpensesResponse = await fetch('/api/expenses', {
            credentials: 'include'
        });

        if (!allExpensesResponse.ok) {
            throw new Error('Failed to fetch updated expenses');
        }

        const allExpenses = await allExpensesResponse.json();
        
        // Apply current filters to the new data
        const filteredExpenses = filterExpenses(allExpenses);
        
        // Update charts and totals with filtered data
        updateCharts(filteredExpenses);
        updateTotals(filteredExpenses);

    } catch (error) {
        console.error('Error deleting expense:', error);
        showNotification(error.message, 'error');
    }
}

// Validate expense form
function validateExpenseForm(data) {
    if (!data.name || !data.category || !data.amount || !data.date || !data.paymentMethod) {
        showNotification('Please fill in all required fields', 'error');
        return false;
    }
    if (data.amount <= 0) {
        showNotification('Amount must be greater than 0', 'error');
        return false;
    }
    if (!data.name.trim()) {
        showNotification('Expense name cannot be empty', 'error');
        return false;
    }
    return true;
}

// Show notification
function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Trigger reflow to enable animation
    toast.offsetHeight;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Format currency
function formatCurrency(amount) {
    return `KES ${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

// Format date
function formatDate(dateString) {
    return moment(dateString).format('DD MMM YYYY HH:mm');
}

// Update current date
function updateCurrentDate() {
    const date = new Date();
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    document.getElementById('currentDate').textContent = date.toLocaleDateString('en-US', options);
}

// Update the logout handler
async function handleLogout() {
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
        showNotification('Logout failed', 'error');
    }
}

// Utility function for debouncing
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

// Handle export
async function handleExport() {
    const dateRange = document.getElementById('exportDateRange').value;
    
    if (!dateRange) {
        showNotification('Please select a date range for export', 'error');
        return;
    }

    const [startStr, endStr] = dateRange.split(' to ');
    if (!startStr || !endStr) {
        showNotification('Please select both start and end dates', 'error');
        return;
    }

    try {
        // Show loading notification
        showNotification('Preparing export...', 'info');

        // Get all expenses
        const response = await fetch('/api/expenses', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch expenses');
        }

        const expenses = await response.json();

        // Filter expenses by date range
        const startDate = new Date(startStr);
        const endDate = new Date(endStr);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const filteredExpenses = expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= startDate && expenseDate <= endDate;
        });

        if (filteredExpenses.length === 0) {
            showNotification('No expenses found in selected date range', 'error');
            return;
        }

        // Prepare data for Excel
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(filteredExpenses.map(expense => ({
            'Name': expense.name,
            'Category': expense.category,
            'Amount (KES)': expense.amount,
            'Date': new Date(expense.date).toLocaleString(),
            'Payment Method': expense.paymentMethod,
            'Description': expense.description || ''
        })));

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');

        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses_${startStr}_to_${endStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showNotification('Expenses exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting expenses:', error);
        showNotification('Failed to export expenses: ' + error.message, 'error');
    }
}

// Edit Ticket
async function editTicket(id) {
    try {
        const response = await fetch(`/api/tickets/${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch ticket details');
        }
        const ticket = await response.json();
        
        // Get the modal elements
        const editTicketModal = document.getElementById('editTicketModal');
        const editTicketId = document.getElementById('editTicketId');
        const editTicketStatus = document.getElementById('editTicketStatus');
        
        if (!editTicketModal || !editTicketId || !editTicketStatus) {
            throw new Error('Edit ticket modal elements not found');
        }
        
        // Populate the edit form with ticket data
        editTicketId.value = ticket._id;
        editTicketStatus.value = ticket.status;
        
        // Show the edit modal
        editTicketModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Error fetching ticket:', error);
        showNotification('Error fetching ticket details', 'error');
    }
}

// Handle Edit Form Submit
async function handleEditSubmit(e) {
    e.preventDefault();
    
    const editTicketId = document.getElementById('editTicketId');
    const editTicketStatus = document.getElementById('editTicketStatus');
    const editTicketModal = document.getElementById('editTicketModal');
    
    if (!editTicketId || !editTicketStatus || !editTicketModal) {
        showNotification('Error: Edit ticket form elements not found', 'error');
        return;
    }

    const id = editTicketId.value;
    const formData = {
        status: editTicketStatus.value
    };

    try {
        const response = await fetch(`/api/tickets/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to update ticket');
        }

        // Close the modal
        editTicketModal.style.display = 'none';
        document.body.style.overflow = '';
        
        // Refresh the data
        await loadTickets();
        await loadMonthlyStats();

        showNotification('Ticket status updated successfully', 'success');
    } catch (error) {
        console.error('Error updating ticket:', error);
        showNotification('Error updating ticket', 'error');
    }
}

// Add event listener for edit ticket form
document.addEventListener('DOMContentLoaded', () => {
    const editTicketForm = document.getElementById('editTicketForm');
    const editTicketModal = document.getElementById('editTicketModal');
    
    if (editTicketForm) {
        editTicketForm.addEventListener('submit', handleEditSubmit);
    }
    
    // Add close button handler for edit ticket modal
    if (editTicketModal) {
        const closeButtons = editTicketModal.querySelectorAll('.close-modal');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                editTicketModal.style.display = 'none';
                document.body.style.overflow = '';
            });
        });
    }
}); 