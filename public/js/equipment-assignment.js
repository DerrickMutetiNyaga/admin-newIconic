// DOM Elements
const assignmentForm = document.getElementById('assignmentForm');
const equipmentSelect = document.getElementById('equipmentSelect');
const stationFilter = document.getElementById('stationFilter');
const assignmentSearch = document.getElementById('assignmentSearch');
const assignmentsList = document.getElementById('assignmentsList');
const exportBtn = document.getElementById('exportAssignmentsBtn');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, setting up event listeners for assignment modal.');
    checkAuth();
    loadUnassignedEquipment();
    loadAssignments();
    setupEventListeners();
});

// Authentication check
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        const data = await response.json();
        if (!data.authenticated || !data.username) {
            window.location.href = '/login.html';
            return;
        }
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            let displayName = data.username;
            if (data.role) displayName += ` (${data.role.charAt(0).toUpperCase() + data.role.slice(1)})`;
            usernameElement.textContent = displayName;
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
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
    }
}

// Load unassigned equipment
async function loadUnassignedEquipment() {
    try {
        const response = await fetch('/api/equipment-assignments/unassigned');
        if (!response.ok) throw new Error('Failed to load unassigned equipment');
        
        const equipment = await response.json();
        populateEquipmentSelect(equipment);
    } catch (error) {
        console.error('Error loading unassigned equipment:', error);
        showNotification('Error loading equipment', 'error');
    }
}

// Populate equipment select dropdown
function populateEquipmentSelect(equipment) {
    equipmentSelect.innerHTML = '<option value="">Select Equipment</option>';
    equipment.forEach(item => {
        const option = document.createElement('option');
        option.value = item._id;
        // Display both equipment name and model name if available
        const displayText = item.modelName 
            ? `${item.equipmentName} - ${item.modelName} (${item.macAddress})`
            : `${item.equipmentName} (${item.macAddress})`;
        option.textContent = displayText;
        equipmentSelect.appendChild(option);
    });
}

// Load assignments
async function loadAssignments() {
    try {
        const response = await fetch('/api/equipment-assignments/assignments');
        if (!response.ok) {
            if (response.status === 503) {
                throw new Error('Database connection error. Please try again later.');
            }
            throw new Error('Failed to load assignments');
        }
        
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) {
            throw new Error(result.error || result.message || 'Invalid assignments data format');
        }
        displayAssignments(result.data);
    } catch (error) {
        console.error('Error loading assignments:', error);
        const assignmentsList = document.getElementById('assignmentsList');
        if (assignmentsList) {
            assignmentsList.innerHTML = `
                <div class="no-data error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Unable to Load Assignments</p>
                    <span>${error.message || 'Please try again later'}</span>
                    <button class="btn-primary" onclick="loadAssignments()">
                        <i class="fas fa-sync-alt"></i> Retry
                    </button>
                </div>
            `;
        }
        showNotification(error.message || 'Error loading assignments', 'error');
    }
}

// Display assignments in the grid
function displayAssignments(assignments) {
    const assignmentsList = document.getElementById('assignmentsList');
    if (!assignmentsList) {
        console.error('Assignments list element not found');
        return;
    }

    if (!assignments || assignments.length === 0) {
        assignmentsList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-link"></i>
                <p>No Assignments Found</p>
                <span>Assign equipment to get started</span>
            </div>
        `;
        return;
    }

    // Get user role for conditional rendering
    const userRole = document.getElementById('username')?.textContent?.match(/\((.*?)\)/)?.[1]?.toLowerCase();

    assignmentsList.innerHTML = assignments.map(assignment => {
        // Handle both populated and unpopulated equipment references
        const equipment = assignment.equipment || assignment.equipmentId || {};
        const equipmentName = equipment.name || equipment.equipmentName || 'Unknown Equipment';
        const macAddress = equipment.macAddress || 'N/A';
        
        // Format the createdAt date
        const assignedDate = assignment.createdAt 
            ? new Date(assignment.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'N/A';

        return `
        <div class="assignment-card">
            <div class="assignment-header">
                <div class="assignment-title">
                    <h3>${equipmentName}</h3>
                    <span class="assignment-type">${assignment.assignmentType === 'client' ? 'Client Assignment' : 'Barrack Assignment'}</span>
                </div>
                <div class="assignment-actions">
                    <button class="btn-icon edit" onclick="editAssignment('${assignment._id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${userRole !== 'staff' ? `
                        <button class="btn-icon delete" onclick="deleteAssignment('${assignment._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="assignment-body">
                <div class="assignment-info">
                    <div class="info-item">
                        <i class="fas fa-user"></i>
                        <div class="info-content">
                            <span class="info-label">${assignment.assignmentType === 'client' ? 'Client Name' : 'Barrack Name'}</span>
                            <span class="info-value">${assignment.assigneeName || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-building"></i>
                        <div class="info-content">
                            <span class="info-label">Station</span>
                            <span class="info-value">${assignment.stationName || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-network-wired"></i>
                        <div class="info-content">
                            <span class="info-label">MAC Address</span>
                            <span class="info-value">${macAddress}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-calendar"></i>
                        <div class="info-content">
                            <span class="info-label">Assigned Date</span>
                            <span class="info-value">${assignedDate}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');

    // Update stats
    updateStats(assignments);
}

// Update stats
function updateStats(assignments) {
    if (!assignments) return;
    
    const stats = {
        total: assignments.length || 0,
        client: assignments.filter(a => a.assignmentType === 'client').length || 0,
        barrack: assignments.filter(a => a.assignmentType === 'barrack').length || 0,
        active: assignments.filter(a => a.status === 'active').length || 0
    };

    // Update each stat if the element exists
    const totalElement = document.getElementById('totalAssignments');
    const clientElement = document.getElementById('clientAssignments');
    const barrackElement = document.getElementById('barrackAssignments');
    const activeElement = document.getElementById('activeAssignments');

    if (totalElement) totalElement.textContent = stats.total;
    if (clientElement) clientElement.textContent = stats.client;
    if (barrackElement) barrackElement.textContent = stats.barrack;
    if (activeElement) activeElement.textContent = stats.active;
}

// Handle form submission
assignmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        equipmentId: document.getElementById('equipmentSelect').value,
        assigneeName: document.getElementById('assigneeName').value,
        stationName: document.getElementById('stationName').value,
        assignmentType: document.querySelector('input[name="assignmentType"]:checked').value
    };

    const editId = assignmentForm.dataset.editId;
    const url = editId
        ? `/api/equipment-assignments/assignments/${editId}`
        : '/api/equipment-assignments/assign';
    const method = editId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || (editId ? 'Failed to update assignment' : 'Failed to assign equipment'));
        }

        showNotification(editId ? 'Assignment updated successfully' : 'Equipment assigned successfully', 'success');
        closeModal('assignmentModal');
        assignmentForm.reset();
        delete assignmentForm.dataset.editId;
        
        // Refresh data
        loadUnassignedEquipment();
        loadAssignments();
    } catch (error) {
        console.error(editId ? 'Error updating assignment:' : 'Error assigning equipment:', error);
        showNotification(error.message || (editId ? 'Error updating assignment' : 'Error assigning equipment'), 'error');
    }
});

// Edit assignment
async function editAssignment(id) {
    try {
        const response = await fetch(`/api/equipment-assignments/assignments/${id}`);
        if (!response.ok) throw new Error('Failed to fetch assignment details');
        
        const assignment = await response.json();
        console.log('Loaded assignment:', assignment);
        
        // Ensure assignedEquipmentId is a string (handle both string and object)
        let assignedEquipmentId = assignment.equipmentId;
        if (assignedEquipmentId && typeof assignedEquipmentId === 'object' && assignedEquipmentId._id) {
            assignedEquipmentId = assignedEquipmentId._id;
        } else if (typeof assignedEquipmentId === 'string') {
            // do nothing
        } else {
            assignedEquipmentId = '';
        }
        console.log('Assigned equipmentId:', assignedEquipmentId);

        const equipmentSelect = document.getElementById('equipmentSelect');
        let optionExists = false;
        for (let i = 0; i < equipmentSelect.options.length; i++) {
            if (equipmentSelect.options[i].value === assignedEquipmentId) {
                optionExists = true;
                break;
            }
        }
        console.log('Option exists in dropdown:', optionExists);
        if (!optionExists && assignedEquipmentId) {
            try {
                const res = await fetch(`/api/equipment/${assignedEquipmentId}`);
                console.log('Fetching equipment:', `/api/equipment/${assignedEquipmentId}`, 'Status:', res.status);
                if (res.ok) {
                    const equipment = await res.json();
                    console.log('Fetched equipment:', equipment);
                    const option = document.createElement('option');
                    option.value = equipment._id;
                    // Display both equipment name and model name if available
                    const displayText = equipment.modelName 
                        ? `${equipment.equipmentName} - ${equipment.modelName} (${equipment.macAddress})`
                        : `${equipment.equipmentName} (${equipment.macAddress})`;
                    option.textContent = displayText;
                    equipmentSelect.appendChild(option);
                    equipmentSelect.value = equipment._id;
                    document.getElementById('macAddress').value = equipment.macAddress || '';
                } else {
                    equipmentSelect.value = '';
                    document.getElementById('macAddress').value = '';
                    console.log('Failed to fetch equipment:', res.status);
                }
            } catch (err) {
                equipmentSelect.value = '';
                document.getElementById('macAddress').value = '';
                console.log('Error fetching equipment:', err);
            }
        } else if (assignedEquipmentId) {
            equipmentSelect.value = assignedEquipmentId;
            try {
                const res = await fetch(`/api/equipment/${assignedEquipmentId}`);
                console.log('Fetching equipment for MAC:', `/api/equipment/${assignedEquipmentId}`, 'Status:', res.status);
                if (res.ok) {
                    const equipment = await res.json();
                    document.getElementById('macAddress').value = equipment.macAddress || '';
                    console.log('Fetched equipment for MAC:', equipment);
                } else {
                    document.getElementById('macAddress').value = '';
                    console.log('Failed to fetch equipment for MAC:', res.status);
                }
            } catch (err) {
                document.getElementById('macAddress').value = '';
                console.log('Error fetching equipment for MAC:', err);
            }
        } else {
            equipmentSelect.value = '';
            document.getElementById('macAddress').value = '';
        }
        console.log('Dropdown options:', Array.from(equipmentSelect.options).map(o => ({ value: o.value, text: o.text })), 'Assigned value:', assignedEquipmentId, 'Selected value:', equipmentSelect.value);
        document.getElementById('assigneeName').value = assignment.assigneeName;
        document.getElementById('stationName').value = assignment.stationName;
        document.querySelector(`input[name="assignmentType"][value="${assignment.assignmentType}"]`).checked = true;

        // Update form for edit mode
        assignmentForm.dataset.editId = id;
        document.querySelector('.modal-header h2').textContent = 'Edit Assignment';
        document.querySelector('button[type="submit"]').textContent = 'Update Assignment';
        
        showModal('assignmentModal');
    } catch (error) {
        console.error('Error fetching assignment:', error);
        showNotification('Error loading assignment details', 'error');
    }
}

// Delete assignment
async function deleteAssignment(id) {
    if (!confirm('Are you sure you want to delete this assignment?')) {
        return;
    }

    try {
        const response = await fetch(`/api/equipment-assignments/assignments/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete assignment');

        showNotification('Assignment deleted successfully', 'success');
        loadAssignments();
    } catch (error) {
        console.error('Error deleting assignment:', error);
        showNotification('Error deleting assignment', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    if (assignmentSearch) {
        assignmentSearch.addEventListener('input', debounce(() => {
            const searchTerm = assignmentSearch.value.toLowerCase();
            const assignments = document.querySelectorAll('.assignment-card');
            assignments.forEach(card => {
                const text = card.textContent.toLowerCase();
                card.style.display = text.includes(searchTerm) ? 'block' : 'none';
            });
        }, 300));
    }

    // Station filter
    if (stationFilter) {
        stationFilter.addEventListener('change', () => {
            const selectedStation = stationFilter.value;
            const assignments = document.querySelectorAll('.assignment-card');
            assignments.forEach(card => {
                const station = card.querySelector('.detail-item:nth-child(2) span').textContent;
                card.style.display = !selectedStation || station === selectedStation ? 'block' : 'none';
            });
        });
    }

    // Export functionality
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async function() {
            try {
                const search = document.getElementById('assignmentSearch')?.value || '';
                const station = document.getElementById('stationFilter')?.value || '';
                
                // Show loading state
                exportBtn.disabled = true;
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
                
                // Build export URL
                let url = '/api/equipment-assignments/export';
                const params = new URLSearchParams();
                if (search) params.append('search', search);
                if (station) params.append('station', station);
                if (params.toString()) url += '?' + params.toString();

                // Fetch the export
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Failed to export assignments');
                }

                // Get the blob from the response
                const blob = await response.blob();
                
                // Create download link
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `equipment-assignments-${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(downloadUrl);

                showNotification('Export completed successfully', 'success');
            } catch (error) {
                console.error('Export error:', error);
                showNotification(error.message || 'Failed to export assignments', 'error');
            } finally {
                // Reset button state
                exportBtn.disabled = false;
                exportBtn.innerHTML = '<i class="fas fa-file-excel"></i> Export';
            }
        });
    }

    // New Assignment button
    const newAssignmentBtn = document.getElementById('newAssignmentBtn');
    if (newAssignmentBtn) {
        newAssignmentBtn.addEventListener('click', () => {
            showModal('assignmentModal');
        });
    }
    // Mobile FAB
    const mobileNewAssignmentBtn = document.getElementById('mobileNewAssignmentBtn');
    if (mobileNewAssignmentBtn) {
        mobileNewAssignmentBtn.addEventListener('click', () => {
            showModal('assignmentModal');
        });
    }

    // Close modal buttons (Cancel and X)
    const closeButtons = document.querySelectorAll('.close-modal, .btn-secondary');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Close modal when clicking outside the modal content
    document.addEventListener('click', function(e) {
        // Close modal on Cancel or X
        if (e.target.classList.contains('close-modal') || e.target.classList.contains('btn-secondary')) {
            let modal = e.target.closest('.modal');
            if (!modal) {
                // If the button is inside modal-content, walk up to parent .modal
                let parent = e.target.parentElement;
                while (parent && !parent.classList.contains('modal')) {
                    parent = parent.parentElement;
                }
                modal = parent;
            }
            if (modal) {
                closeModal(modal.id);
            }
        }
        // Close modal when clicking outside modal-content
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => closeModal(modal.id));
        }
    });
}

// Utility functions
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

// Modal functions
async function populateStationDropdown() {
    const stationSelect = document.getElementById('stationName');
    if (!stationSelect) return;
    stationSelect.innerHTML = '<option value="">Select station...</option>';
    try {
        const response = await fetch('/api/stations', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch stations');
        const stations = await response.json();
        stations.forEach(station => {
            const option = document.createElement('option');
            option.value = station.name;  // Set the value to station name
            option.textContent = station.name;  // Set the display text
            stationSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching stations:', error);
        showNotification('Error loading stations', 'error');
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        console.log('Modal shown:', modalId);
        if (modalId === 'assignmentModal') {
            populateStationDropdown();
        }
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Reset form if it's the assignment form
        if (modalId === 'assignmentModal') {
            assignmentForm.reset();
            delete assignmentForm.dataset.editId;
            document.querySelector('.modal-header h2').textContent = 'Assign Equipment';
            document.querySelector('button[type="submit"]').textContent = 'Save Assignment';
        }
    }
} 