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
        // Show loading overlay
        if (elements.authLoading) elements.authLoading.style.display = 'flex';
        
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

        // Show/hide station link based on role
        const stationLink = document.querySelector('.station-link');
        if (stationLink) {
            if (data.role === 'admin' || data.role === 'superadmin') {
                stationLink.style.display = 'block';
            } else {
                stationLink.style.display = 'none';
            }
        }

        // Hide delete buttons for staff users
        if (data.role === 'staff') {
            document.querySelectorAll('.btn-icon.delete').forEach(btn => {
                btn.style.display = 'none';
            });
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
        if (elements.mainContent) elements.mainContent.style.display = 'block';

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
    console.log('Initializing page...'); // Debug log
    setupEventListeners();
    loadEquipment();
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

    // Close modal buttons
    const closeButtons = document.querySelectorAll('.close-modal, .btn-secondary');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

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

    // Export to Excel and Export functionality (merged)
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async function() {
            try {
                const search = elements.equipmentSearch?.value || '';
                const status = document.getElementById('statusFilter')?.value || '';
                
                // Show loading state
                exportBtn.disabled = true;
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
                
                // Build export URL
                let url = '/api/equipment/export';
                const params = new URLSearchParams();
                if (search) params.append('search', search);
                if (status) params.append('status', status);
                if (params.toString()) url += '?' + params.toString();

                // Fetch the export
                const response = await fetch(url, { credentials: 'include' });
                if (!response.ok) {
                    throw new Error('Failed to export equipment');
                }

                // Get the blob from the response
                const blob = await response.blob();
                
                // Create download link
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `equipment-${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl);

                showNotification('Export completed successfully', 'success');
            } catch (error) {
                console.error('Export error:', error);
                showNotification(error.message || 'Failed to export equipment', 'error');
            } finally {
                // Reset button state
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Export';
            }
        });
    }

    // Search functionality for card filtering
    if (elements.equipmentSearch) {
        elements.equipmentSearch.addEventListener('input', debounce(() => {
            const searchTerm = elements.equipmentSearch.value.toLowerCase();
            const equipment = document.querySelectorAll('.equipment-card');
            equipment.forEach(card => {
                const text = card.textContent.toLowerCase();
                card.style.display = text.includes(searchTerm) ? 'block' : 'none';
            });
        }, 300));
    }

    // MAC Address input formatting
    const macAddressInput = document.getElementById('macAddress');
    if (macAddressInput) {
        macAddressInput.addEventListener('input', function(e) {
            // Remove any non-alphanumeric characters
            let value = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
            
            // Limit to 12 characters (6 pairs)
            value = value.slice(0, 12);
            
            // Add colons after every 2 characters
            let formattedValue = '';
            for (let i = 0; i < value.length; i++) {
                if (i > 0 && i % 2 === 0) {
                    formattedValue += ':';
                }
                formattedValue += value[i];
            }
            
            // Update input value
            e.target.value = formattedValue;
            
            // Add visual feedback for valid/invalid format
            const isValid = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(formattedValue);
            e.target.style.borderColor = isValid ? '#28a745' : '#dc3545';
            
            // Add/remove error message
            let errorMsg = e.target.parentElement.querySelector('.mac-error');
            if (!isValid && formattedValue.length > 0) {
                if (!errorMsg) {
                    errorMsg = document.createElement('div');
                    errorMsg.className = 'mac-error';
                    errorMsg.style.color = '#dc3545';
                    errorMsg.style.fontSize = '0.8rem';
                    errorMsg.style.marginTop = '0.25rem';
                    e.target.parentElement.appendChild(errorMsg);
                }
                errorMsg.textContent = 'MAC address must be in format: XX:XX:XX:XX:XX:XX';
            } else if (errorMsg) {
                errorMsg.remove();
            }
        });

        // Prevent paste of invalid characters
        macAddressInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const cleanText = pastedText.replace(/[^0-9A-Fa-f]/g, '').slice(0, 12);
            
            // Trigger input event with cleaned text
            const inputEvent = new Event('input', { bubbles: true });
            macAddressInput.value = cleanText;
            macAddressInput.dispatchEvent(inputEvent);
        });

        // Convert to uppercase on blur
        macAddressInput.addEventListener('blur', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    }
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
        
        // Reset form if it's the equipment modal
        if (modalId === 'equipmentModal') {
            const form = document.getElementById('equipmentForm');
            if (form) {
                form.reset();
                delete form.dataset.equipmentId;
                
                // Reset modal title and button
                const modalTitle = document.querySelector('#equipmentModal h2');
                const submitButton = form.querySelector('button[type="submit"]');
                if (modalTitle) modalTitle.textContent = 'Add New Equipment';
                if (submitButton) submitButton.textContent = 'Save Equipment';
            }
        }
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

        const response = await fetch(url, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load equipment');
        }

        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) {
            throw new Error(result.error || result.message || 'Invalid equipment data format');
        }
        console.log('Loaded equipment data:', result.data);
        displayEquipment(result.data);
        updateStats(result.data);
    } catch (error) {
        console.error('Error loading equipment:', error);
        showNotification('Error loading equipment', 'error');
        
        // Show error state in the equipment list
        const equipmentList = document.getElementById('equipmentList');
        if (equipmentList) {
            equipmentList.innerHTML = `
                <div class="no-data error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Unable to Load Equipment</p>
                    <span>${error.message || 'Please try again later'}</span>
                    <button class="btn-primary" onclick="loadEquipment()">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

// Add pagination state
let currentPage = 1;
const itemsPerPage = 9;

// Display equipment in the grid
function displayEquipment(equipment) {
    const equipmentList = document.getElementById('equipmentList');
    if (!equipmentList) {
        console.error('Equipment list element not found');
        return;
    }

    // Remove any existing pagination controls that are siblings
    let nextElem = equipmentList.nextElementSibling;
    while (nextElem && nextElem.classList.contains('pagination')) {
        const toRemove = nextElem;
        nextElem = nextElem.nextElementSibling;
        toRemove.remove();
    }

    if (!equipment || equipment.length === 0) {
        equipmentList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-network-wired"></i>
                <p>No Equipment Found</p>
                <span>Add new equipment to get started</span>
            </div>
        `;
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(equipment.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedEquipment = equipment.slice(startIndex, endIndex);

    // Get user role for conditional rendering
    const userRole = document.getElementById('username')?.textContent?.match(/\((.*?)\)/)?.[1]?.toLowerCase();

    // Display equipment cards
    equipmentList.innerHTML = paginatedEquipment.map(item => `
        <div class="equipment-card">
            <div class="equipment-header">
                <div class="equipment-title">
                    <h3>${item.equipmentName || 'Unnamed Equipment'}</h3>
                    ${item.modelName ? `<span class="equipment-model">${item.modelName}</span>` : ''}
                </div>
                <div class="equipment-actions">
                    <button class="btn-icon edit" onclick="editEquipment('${item._id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${userRole !== 'staff' ? `
                        <button class="btn-icon delete" onclick="deleteEquipment('${item._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="equipment-body">
                <div class="equipment-info">
                    ${item.macAddress ? `
                        <div class="info-item">
                            <i class="fas fa-network-wired"></i>
                            <div class="info-content">
                                <span class="info-label">MAC Address</span>
                                <span class="info-value">${item.macAddress}</span>
                            </div>
                        </div>
                    ` : ''}
                    ${item.serialNumber ? `
                        <div class="info-item">
                            <i class="fas fa-barcode"></i>
                            <div class="info-content">
                                <span class="info-label">Serial Number</span>
                                <span class="info-value">${item.serialNumber}</span>
                            </div>
                        </div>
                    ` : ''}
                    ${item.description ? `
                        <div class="info-item">
                            <i class="fas fa-info-circle"></i>
                            <div class="info-content">
                                <span class="info-label">Description</span>
                                <span class="info-value">${item.description}</span>
                            </div>
                        </div>
                    ` : ''}
                    ${item.purchaseDate ? `
                        <div class="info-item">
                            <i class="fas fa-calendar"></i>
                            <div class="info-content">
                                <span class="info-label">Purchase Date</span>
                                <span class="info-value">${new Date(item.purchaseDate).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="equipment-footer">
                <div class="equipment-status" data-status="${item.status || 'In Stock'}">
                    <i class="fas ${getStatusIcon(item.status)}"></i>
                    ${item.status || 'In Stock'}
                </div>
            </div>
        </div>
    `).join('');

    // Add pagination controls if there are multiple pages
    if (totalPages > 1) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination';
        paginationContainer.innerHTML = `
            <button class="pagination-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Previous
            </button>
            <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
            <button class="pagination-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
        equipmentList.after(paginationContainer);
    }
}

// Function to change page
function changePage(newPage) {
    if (newPage < 1) return;
    const equipmentList = document.getElementById('equipmentList');
    const totalPages = Math.ceil(equipmentList.dataset.totalItems / itemsPerPage);
    if (newPage > totalPages) return;
    
    currentPage = newPage;
    loadEquipment();
}

// Helper function to get status icon
function getStatusIcon(status) {
    switch (status) {
        case 'Assigned':
            return 'fa-check-circle';
        case 'Under Maintenance':
            return 'fa-tools';
        default:
            return 'fa-box';
    }
}

// Update stats
function updateStats(data) {
    if (!data) return;
    
    const stats = {
        total: data.length || 0,
        active: data.filter(item => item.status === 'Assigned').length || 0,
        maintenance: data.filter(item => item.status === 'Under Maintenance').length || 0,
        remaining: data.filter(item => item.status === 'In Stock').length || 0
    };

    const elements = {
        totalEquipment: document.getElementById('totalEquipment'),
        activeEquipment: document.getElementById('activeEquipment'),
        maintenanceRequired: document.getElementById('maintenanceRequired'),
        remainingEquipment: document.getElementById('remainingEquipment')
    };

    // Update each stat if the element exists
    if (elements.totalEquipment) elements.totalEquipment.textContent = stats.total;
    if (elements.activeEquipment) elements.activeEquipment.textContent = stats.active;
    if (elements.maintenanceRequired) elements.maintenanceRequired.textContent = stats.maintenance;
    if (elements.remainingEquipment) elements.remainingEquipment.textContent = stats.remaining;
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