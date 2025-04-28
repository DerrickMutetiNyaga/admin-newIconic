// DOM Elements
const elements = {
    authLoading: document.getElementById('authLoading'),
    mainContent: document.querySelector('.main-content'),
    username: document.getElementById('username'),
    logoutBtn: document.getElementById('logout'),
    newEquipmentBtn: document.getElementById('newEquipmentBtn'),
    equipmentModal: document.getElementById('equipmentModal'),
    equipmentForm: document.getElementById('equipmentForm'),
    equipmentList: document.getElementById('equipmentList'),
    equipmentSearch: document.getElementById('equipmentSearch'),
    equipmentNameFilter: document.getElementById('equipmentNameFilter'),
    stationSearch: document.getElementById('stationSearch')
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

        // Update username with role indicator
        if (elements.username) {
            elements.username.textContent = `${data.username} (${data.role})`;
        }

        // Show/hide approvals link based on role
        const approvalsLink = document.getElementById('approvalsLink');
        if (data.role === 'admin' || data.role === 'superadmin') {
            if (approvalsLink) approvalsLink.style.display = 'block';
        } else {
            if (approvalsLink) approvalsLink.style.display = 'none';
        }

        // Add logout handler
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', async () => {
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
        if (elements.authLoading) elements.authLoading.style.display = 'none';
        if (elements.mainContent) elements.mainContent.classList.add('authenticated');

        // Populate equipment name filter
        await populateEquipmentNameFilter();

        // Initialize the page
        initializePage();
    } catch (error) {
        console.error('Authentication error:', error);
        window.location.href = '/login.html';
    }
});

// Initialize page functionality
function initializePage() {
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    loadEquipment();
    
    // Update current date
    updateCurrentDate();
}

// Set up event listeners
function setupEventListeners() {
    // New Equipment button
    if (elements.newEquipmentBtn) {
        elements.newEquipmentBtn.addEventListener('click', () => {
            showModal('equipmentModal');
        });
    }

    // Equipment form submission
    if (elements.equipmentForm) {
        elements.equipmentForm.addEventListener('submit', handleEquipmentSubmit);
    }

    // Search and filter
    if (elements.equipmentSearch) {
        elements.equipmentSearch.addEventListener('input', debounce(() => {
            loadEquipment();
        }, 300));
    }

    if (elements.equipmentNameFilter) {
        elements.equipmentNameFilter.addEventListener('change', () => {
            loadEquipment();
        });
    }

    // Export to Excel
    const exportBtn = document.getElementById('exportEquipmentBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            const equipmentName = document.getElementById('equipmentNameFilter')?.value || '';
            const search = document.getElementById('equipmentSearch')?.value || '';
            const station = document.getElementById('stationSearch')?.value || '';
            let url = '/api/equipment/export?';
            if (equipmentName) url += `equipmentName=${encodeURIComponent(equipmentName)}&`;
            if (search) url += `search=${encodeURIComponent(search)}&`;
            if (station) url += `station=${encodeURIComponent(station)}&`;
            url = url.replace(/&$/, '');
            window.open(url, '_blank');
        });
    }

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });

    // Close modal when pressing Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => closeModal(modal.id));
        }
    });
}

// Update current date
function updateCurrentDate() {
    const date = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        dateElement.textContent = date.toLocaleDateString('en-US', options);
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Debounce function
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

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Handle equipment form submission
async function handleEquipmentSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = {
        equipmentName: form.equipmentName.value,
        modelName: form.modelName.value,
        macAddress: form.macAddress.value,
        purchaseDate: form.purchaseDate.value || null,
        status: form.status.value
    };

    // Validate required fields
    if (!formData.equipmentName || !formData.modelName || !formData.macAddress || !formData.status) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }

    // Validate MAC address format
    const macRegex = /^[0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}$/;
    if (!macRegex.test(formData.macAddress)) {
        showNotification('Please enter a valid MAC address (e.g., 00:00:00:00:00:00)', 'error');
        return;
    }

    try {
        const equipmentId = form.dataset.equipmentId;
        const url = equipmentId ? `/api/equipment/${equipmentId}` : '/api/equipment';
        const method = equipmentId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save equipment');
        }

        showNotification(equipmentId ? 'Equipment updated successfully' : 'Equipment added successfully', 'success');
        closeModal('equipmentModal');
        
        // Reset form and clear equipment ID
        form.reset();
        delete form.dataset.equipmentId;
        
        // Reset modal title and button
        const modalTitle = document.querySelector('#equipmentModal h2');
        const submitButton = form.querySelector('button[type="submit"]');
        if (modalTitle) modalTitle.textContent = 'Add New Equipment';
        if (submitButton) submitButton.textContent = 'Save Equipment';
        
        loadEquipment();
    } catch (error) {
        console.error('Error saving equipment:', error);
        showNotification(error.message || 'Error saving equipment', 'error');
    }
}

// Load equipment data
async function loadEquipment() {
    try {
        const searchQuery = elements.equipmentSearch?.value || '';
        const equipmentName = elements.equipmentNameFilter?.value || '';
        const station = elements.stationSearch?.value || '';
        
        let url = '/api/equipment';
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (equipmentName) params.append('equipmentName', equipmentName);
        if (station) params.append('station', station);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to load equipment');
        }

        const data = await response.json();
        displayEquipment(data);
        updateStats(data);
    } catch (error) {
        console.error('Error loading equipment:', error);
        showNotification('Error loading equipment', 'error');
    }
}

// Display equipment list
function displayEquipment(equipment) {
    if (!elements.equipmentList) return;

    if (!equipment || equipment.length === 0) {
        elements.equipmentList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-network-wired"></i>
                <p>No equipment found</p>
                <span>Add new equipment to get started</span>
            </div>
        `;
        return;
    }

    elements.equipmentList.innerHTML = equipment.map(item => {
        const statusColors = {
            'In Stock': { bg: '#e8f5e9', color: '#2e7d32', icon: 'box' },
            'Assigned': { bg: '#e3f2fd', color: '#1976d2', icon: 'user-check' },
            'Under Maintenance': { bg: '#fff3e0', color: '#f57c00', icon: 'tools' }
        };
        const status = statusColors[item.status] || statusColors['In Stock'];
        
        return `
            <div class="equipment-card">
            <div class="equipment-header">
                    <div class="equipment-title">
                        <h3>${item.equipmentName}</h3>
                        <span class="equipment-model">${item.modelName}</span>
            </div>
            <div class="equipment-actions">
                <button class="btn-icon edit" onclick="editEquipment('${item._id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete" onclick="deleteEquipment('${item._id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
                <div class="equipment-body">
                    <div class="equipment-info">
                        <div class="info-item">
                            <i class="fas fa-fingerprint"></i>
                            <div class="info-content">
                                <span class="info-label">MAC Address</span>
                                <span class="info-value">${item.macAddress}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-calendar-alt"></i>
                            <div class="info-content">
                                <span class="info-label">Purchase Date</span>
                                <span class="info-value">${item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : 'Not specified'}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <i class="fas fa-calendar-check"></i>
                            <div class="info-content">
                                <span class="info-label">Added On</span>
                                <span class="info-value">${new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="equipment-footer">
                    <span class="equipment-status" style="background: ${status.bg}; color: ${status.color}">
                        <i class="fas fa-${status.icon}"></i> ${item.status}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

// Update stats
function updateStats(data) {
    const stats = {
        total: data.length || 0,
        active: data.filter(item => item.status === 'Assigned').length || 0,
        maintenance: data.filter(item => item.status === 'Under Maintenance').length || 0,
        remaining: data.filter(item => item.status === 'In Stock').length || 0
    };

    document.getElementById('totalEquipment').textContent = stats.total;
    document.getElementById('activeEquipment').textContent = stats.active;
    document.getElementById('maintenanceRequired').textContent = stats.maintenance;
    document.getElementById('remainingEquipment').textContent = stats.remaining;
}

// Edit equipment
async function editEquipment(id) {
    try {
        const response = await fetch(`/api/equipment/${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch equipment details');
        }
        const equipment = await response.json();
        
        // Populate form
        const form = document.getElementById('equipmentForm');
        form.equipmentName.value = equipment.equipmentName;
        form.modelName.value = equipment.modelName;
        form.macAddress.value = equipment.macAddress;
        form.purchaseDate.value = equipment.purchaseDate ? new Date(equipment.purchaseDate).toISOString().split('T')[0] : '';
        form.status.value = equipment.status;
        
        // Add equipment ID to form for update
        form.dataset.equipmentId = equipment._id;
        
        // Update modal title and button
        const modalTitle = document.querySelector('#equipmentModal h2');
        const submitButton = form.querySelector('button[type="submit"]');
        if (modalTitle) modalTitle.textContent = 'Edit Equipment';
        if (submitButton) submitButton.textContent = 'Update Equipment';
        
        // Show modal
        showModal('equipmentModal');
    } catch (error) {
        console.error('Error fetching equipment details:', error);
        showNotification('Error loading equipment details', 'error');
    }
}

// Delete equipment
async function deleteEquipment(id) {
    if (!confirm('Are you sure you want to delete this equipment?')) {
        return;
    }

    try {
        const response = await fetch(`/api/equipment/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to delete equipment');
        }

        showNotification('Equipment deleted successfully', 'success');
        loadEquipment();
    } catch (error) {
        console.error('Error deleting equipment:', error);
        showNotification('Error deleting equipment', 'error');
    }
}

// Populate equipment name filter
async function populateEquipmentNameFilter() {
    try {
        const response = await fetch('/api/equipment');
        if (!response.ok) throw new Error('Failed to fetch equipment');
        const data = await response.json();
        const uniqueNames = [...new Set(data.map(eq => eq.equipmentName).filter(Boolean))];
        const select = elements.equipmentNameFilter;
        if (select) {
            select.innerHTML = '<option value="">All Equipment</option>';
            uniqueNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error populating equipment name filter:', error);
    }
} 