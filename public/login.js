document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    console.log('Attempting login for username:', username);
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (response.ok) {
            if (data.redirectUrl) {
                console.log('Redirecting to:', data.redirectUrl);
                // Add a small delay to ensure the session is properly set
                setTimeout(() => {
                    window.location.href = data.redirectUrl;
                }, 100);
            } else {
                console.error('No redirect URL in response:', data);
                showNotification('Error: No redirect URL provided', 'error');
            }
        } else {
            console.error('Login failed:', data.error);
            showNotification(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('An error occurred during login', 'error');
    }
});

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
} 