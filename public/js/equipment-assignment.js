// DOM Elements
const assignmentForm = document.getElementById('assignmentForm');
const equipmentSelect = document.getElementById('equipmentSelect');
const stationFilter = document.getElementById('stationFilter');
const assignmentSearch = document.getElementById('assignmentSearch');
const assignmentsList = document.getElementById('assignmentsList');
const exportBtn = document.getElementById('exportAssignmentsBtn');

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
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
        option.textContent = `${item.equipmentName} (${item.macAddress})`;
        equipmentSelect.appendChild(option);
    });
}

// Load assignments
async function loadAssignments() {
    try {
        const response = await fetch('/api/equipment-assignments/assignments');
        if (!response.ok) throw new Error('Failed to load assignments');
        
        const assignments = await response.json();
        displayAssignments(assignments);
    } catch (error) {
        console.error('Error loading assignments:', error);
        showNotification('Error loading assignments', 'error');
    }
}

// Display assignments
function displayAssignments(assignments) {
    if (!assignments || assignments.length === 0) {
        assignmentsList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-link"></i>
                <p>No assignments found</p>
                <span>Create a new assignment to get started</span>
            </div>
        `;
        return;
    }

    assignmentsList.innerHTML = assignments.map(assignment => `
        <div class="assignment-card">
            <div class="assignment-header">
                <h3>${assignment.equipment.equipmentName}</h3>
                <span class="mac-address">${assignment.equipment.macAddress}</span>
            </div>
            <div class="assignment-details">
                <div class="detail-item">
                    <i class="fas fa-user"></i>
                    <span>${assignment.assigneeName}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${assignment.stationName}</span>
                </div>
                <div class="detail-item">
                    <i class="fas fa-tag"></i>
                    <span>${assignment.assignmentType}</span>
                </div>
            </div>
            <div class="assignment-actions">
                <button class="btn-icon edit" onclick="editAssignment('${assignment._id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete" onclick="deleteAssignment('${assignment._id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
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
                    option.textContent = `${equipment.equipmentName} (${equipment.macAddress})`;
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

    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            const search = document.getElementById('assignmentSearch')?.value || '';
            const station = document.getElementById('stationFilter')?.value || '';
            let url = '/api/equipment-assignments/export?';
            if (search) url += `search=${encodeURIComponent(search)}&`;
            if (station) url += `station=${encodeURIComponent(station)}&`;
            url = url.replace(/&$/, '');
            window.open(url, '_blank');
        });
    }
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
        
        // Reset form if it's the assignment form
        if (modalId === 'assignmentModal') {
            assignmentForm.reset();
            delete assignmentForm.dataset.editId;
            document.querySelector('.modal-header h2').textContent = 'Assign Equipment';
            document.querySelector('button[type="submit"]').textContent = 'Save Assignment';
        }
    }
} 