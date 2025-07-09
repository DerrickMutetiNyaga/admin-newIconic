// Add initial style to hide navigation links
(function() {
    const style = document.createElement('style');
    style.textContent = `
        .nav-links li {
            display: none !important;
        }
        .nav-links li.visible {
            display: block !important;
        }
    `;
    document.head.appendChild(style);
})();

// Function to handle navigation visibility based on user role
function handleNavigationVisibility(userRole) {
    // Get all navigation links
    const allNavLinks = document.querySelectorAll('.nav-links li');
    const dashboardLink = document.querySelector('a[href="index.html"]').parentElement;
    const expensesLink = document.querySelector('a[href="expenses.html"]').parentElement;
    const approvalsLink = document.querySelector('#approvalsLink');
    const stationsLink = document.querySelector('.station-link');
    const reportsLink = document.querySelector('a[href="reports.html"]')?.parentElement;
    const settingsLink = document.querySelector('a[href="settings.html"]')?.parentElement;
    const remindersLink = document.querySelector('a[href="reminders.html"]')?.parentElement;

    // Remove all visible classes first
    allNavLinks.forEach(link => {
        link.classList.remove('visible');
    });

    // Handle visibility based on role
    if (userRole === 'staff') {
        // Show only allowed pages for staff
        const allowedLinks = [
            document.querySelector('a[href="tickets.html"]').parentElement,
            document.querySelector('a[href="equipment.html"]').parentElement,
            document.querySelector('a[href="equipment-assignment.html"]').parentElement,
            document.querySelector('a[href="hotspot-issues.html"]').parentElement
        ];

        allowedLinks.forEach(link => {
            if (link) link.classList.add('visible');
        });

        // Check if current page is allowed
        const currentPath = window.location.pathname;
        const allowedPaths = ['/tickets.html', '/equipment.html', '/equipment-assignment.html', '/hotspot-issues.html'];
        
        if (!allowedPaths.includes(currentPath)) {
            // If trying to access unauthorized page, log out
            handleUnauthorizedAccess();
        }
    } else if (userRole === 'admin' || userRole === 'superadmin') {
        // Show all links for admin and superadmin
        allNavLinks.forEach(link => {
            if (link) link.classList.add('visible');
        });
    }

    // Special handling for reminders link - only show for admin and superadmin
    if (remindersLink) {
        if (userRole === 'admin' || userRole === 'superadmin') {
            remindersLink.style.display = 'block';
        } else {
            remindersLink.style.display = 'none';
            // If on reminders page and not authorized, redirect to dashboard
            if (window.location.pathname === '/reminders.html') {
                window.location.href = '/index.html';
            }
        }
    }
}

// Function to handle unauthorized access
async function handleUnauthorizedAccess() {
    try {
        // Call logout endpoint
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (response.ok) {
            // Clear any local storage or session data
            localStorage.clear();
            sessionStorage.clear();
            
            // Redirect to login page
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error during logout:', error);
        // Force redirect to login page even if logout fails
        window.location.href = '/login.html';
    }
}

// Modify the existing auth check to include navigation handling
async function checkAuth() {
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

        // Update username display
        const usernameElements = document.querySelectorAll('#username');
        usernameElements.forEach(element => {
            element.textContent = data.username;
        });

        // Handle navigation visibility based on role
        handleNavigationVisibility(data.role);

        // Hide auth loading overlay
        const authLoading = document.getElementById('authLoading');
        if (authLoading) {
            authLoading.style.display = 'none';
        }

        // Show main content
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'block';
        }

        return data;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
}

// Call checkAuth when the page loads
document.addEventListener('DOMContentLoaded', checkAuth);

// Add event listener for navigation attempts
document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link && link.getAttribute('href')) {
        const href = link.getAttribute('href');
        const allowedPaths = ['tickets.html', 'equipment.html', 'equipment-assignment.html', 'hotspot-issues.html'];
        
        // Check if user is staff and trying to access unauthorized page
        fetch('/api/auth/check', { credentials: 'include' })
            .then(response => response.json())
            .then(data => {
                if (data.role === 'staff' && !allowedPaths.includes(href)) {
                    event.preventDefault();
                    handleUnauthorizedAccess();
                }
            })
            .catch(error => console.error('Error checking auth status:', error));
    }
});

// Ensure logout button works on all pages
function setupLogoutButton() {
    document.addEventListener('DOMContentLoaded', () => {
        const logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
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
                    if (typeof showNotification === 'function') {
                        showNotification('Logout failed. Please try again.', 'error');
                    } else {
                        alert('Logout failed. Please try again.');
                    }
                }
            });
        }
    });
}
setupLogoutButton(); 