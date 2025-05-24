// DOM Elements
const remindersList = document.getElementById('remindersList');
const newReminderBtn = document.getElementById('newReminderBtn');
const reminderModal = document.getElementById('reminderModal');
const reminderForm = document.getElementById('reminderForm');
const reminderSearch = document.getElementById('reminderSearch');
const modalTitle = document.getElementById('modalTitle');
const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
const sidebar = document.querySelector('.sidebar');
const logoutBtn = document.getElementById('logout');

// Stats elements
const totalRemindersEl = document.getElementById('totalReminders');
const scheduledRemindersEl = document.getElementById('scheduledReminders');
const sentRemindersEl = document.getElementById('sentReminders');
const failedRemindersEl = document.getElementById('failedReminders');

let reminders = [];
let editingId = null;

// Initialize mobile navigation
initializeMobileNavigation();

// Handle logout
logoutBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        if (response.ok) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Fetch reminders and update UI
async function loadReminders() {
    try {
        const res = await fetch('/api/reminders', { credentials: 'include' });
        if (!res.ok) {
            throw new Error('Failed to fetch reminders');
        }
        reminders = await res.json();
        displayReminders(reminders);
        updateStats(reminders);
    } catch (error) {
        console.error('Error loading reminders:', error);
        remindersList.innerHTML = `<div class="no-data error"><i class="fas fa-exclamation-triangle"></i><p>Unable to Load Reminders</p><span>${error.message || 'Please try again later'}</span></div>`;
    }
}

function displayReminders(remindersArr) {
    if (!remindersArr.length) {
        remindersList.innerHTML = `<div class="no-data"><i class="fas fa-bell"></i><p>No Reminders Found</p><span>Add a new reminder to get started</span></div>`;
        return;
    }
    remindersList.innerHTML = remindersArr.map(reminder => `
        <div class="reminder-card">
            <div class="reminder-header">
                <div class="reminder-title">
                    <h3>${reminder.name}</h3>
                </div>
                <div class="reminder-actions">
                    <button class="btn-icon edit" title="Edit" onclick="editReminder('${reminder._id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete" title="Delete" onclick="deleteReminder('${reminder._id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="reminder-body">
                <div class="reminder-info">
                    <div class="info-item"><i class="fas fa-align-left"></i><div class="info-content"><span class="info-label">Description</span><span class="info-value">${reminder.description}</span></div></div>
                    ${reminder.amount ? `<div class="info-item"><i class="fas fa-money-bill"></i><div class="info-content"><span class="info-label">Amount</span><span class="info-value">KES ${reminder.amount.toLocaleString()}</span></div></div>` : ''}
                    ${reminder.category ? `<div class="info-item"><i class="fas fa-tags"></i><div class="info-content"><span class="info-label">Category</span><span class="info-value">${reminder.category}</span></div></div>` : ''}
                    <div class="info-item"><i class="fas fa-phone"></i><div class="info-content"><span class="info-label">Numbers</span><span class="info-value">${reminder.numbers.join(', ')}</span></div></div>
                    <div class="info-item"><i class="fas fa-calendar"></i><div class="info-content"><span class="info-label">Schedule</span><span class="info-value">${reminder.schedule ? new Date(reminder.schedule).toLocaleString() : ''}</span></div></div>
                    <div class="info-item"><i class="fas fa-redo"></i><div class="info-content"><span class="info-label">Frequency</span><span class="info-value">${reminder.frequency}</span></div></div>
                </div>
            </div>
            <div class="reminder-footer">
                <div class="reminder-status" data-status="${reminder.status}">
                    <i class="fas ${reminder.status === 'Scheduled' ? 'fa-clock' : reminder.status === 'Sent' ? 'fa-paper-plane' : 'fa-times-circle'}"></i>
                    ${reminder.status}
                </div>
            </div>
        </div>
    `).join('');
}

function updateStats(remindersArr) {
    totalRemindersEl.textContent = remindersArr.length;
    scheduledRemindersEl.textContent = remindersArr.filter(r => r.status === 'Scheduled').length;
    sentRemindersEl.textContent = remindersArr.filter(r => r.status === 'Sent').length;
    failedRemindersEl.textContent = remindersArr.filter(r => r.status === 'Failed').length;
}

// Modal logic
function showModal() {
    reminderModal.style.display = 'flex';
    // Add active class after a small delay to trigger animation
    setTimeout(() => {
        reminderModal.classList.add('active');
    }, 10);
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    reminderModal.classList.remove('active');
    // Wait for animation to complete before hiding
    setTimeout(() => {
        reminderModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        reminderForm.reset();
        editingId = null;
        modalTitle.textContent = 'Add New Reminder';
    }, 300); // Match this with the CSS transition duration
}

// Add click outside to close
reminderModal.addEventListener('click', (e) => {
    if (e.target === reminderModal) {
        closeModal();
    }
});

// Add escape key to close
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reminderModal.classList.contains('active')) {
        closeModal();
    }
});

document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModal));

// Add new reminder
newReminderBtn.addEventListener('click', () => {
    modalTitle.textContent = 'Add New Reminder';
    editingId = null;
    showModal();
});

// Edit reminder
window.editReminder = async function(id) {
    const res = await fetch(`/api/reminders/${id}`, { credentials: 'include' });
    const reminder = await res.json();
    editingId = id;
    modalTitle.textContent = 'Edit Reminder';
    document.getElementById('reminderName').value = reminder.name;
    document.getElementById('reminderDescription').value = reminder.description;
    document.getElementById('reminderDateTime').value = reminder.schedule ? new Date(reminder.schedule).toISOString().slice(0,16) : '';
    document.getElementById('reminderFrequency').value = reminder.frequency;
    document.getElementById('reminderAmount').value = reminder.amount || '';
    document.getElementById('reminderCategory').value = reminder.category || '';
    showModal();
};

// Delete reminder
window.deleteReminder = async function(id) {
    if (!confirm('Are you sure you want to delete this reminder?')) return;
    try {
        const res = await fetch(`/api/reminders/${id}`, { 
            method: 'DELETE', 
            credentials: 'include' 
        });
        if (!res.ok) throw new Error('Failed to delete reminder');
        loadReminders();
    } catch (error) {
        console.error('Error deleting reminder:', error);
        alert('Failed to delete reminder. Please try again.');
    }
};

// Handle form submit
reminderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const formData = {
            name: document.getElementById('reminderName').value,
            description: document.getElementById('reminderDescription').value,
            schedule: document.getElementById('reminderDateTime').value,
            frequency: document.getElementById('reminderFrequency').value,
            amount: document.getElementById('reminderAmount').value ? parseFloat(document.getElementById('reminderAmount').value) : undefined,
            category: document.getElementById('reminderCategory').value || undefined
        };

        if (document.getElementById('reminderFrequency').value === 'repeat') {
            formData.repeatInterval = parseInt(document.getElementById('repeatInterval').value);
        }

        const url = editingId ? `/api/reminders/${editingId}` : '/api/reminders';
        const method = editingId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData)
        });

        if (!res.ok) throw new Error('Failed to save reminder');

        closeModal();
        loadReminders();
    } catch (error) {
        console.error('Error saving reminder:', error);
        alert('Failed to save reminder. Please try again.');
    }
});

// Search reminders
reminderSearch.addEventListener('input', () => {
    const term = reminderSearch.value.toLowerCase();
    displayReminders(reminders.filter(r => 
        r.name.toLowerCase().includes(term) || 
        r.description.toLowerCase().includes(term)
    ));
});

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authData = await checkAuth();
        if (!authData) return;

        // Initialize the page
        loadReminders();
        
        // Show/hide repeat interval field
        const freq = document.getElementById('reminderFrequency');
        const repeatGroup = document.getElementById('repeatIntervalGroup');
        freq.addEventListener('change', function() {
            repeatGroup.style.display = freq.value === 'repeat' ? 'block' : 'none';
        });
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// Close sidebar when clicking outside
document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && 
        !mobileNavToggle.contains(e.target)) {
        sidebar.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close sidebar on window resize if open
window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        document.body.style.overflow = '';
    }
}); 