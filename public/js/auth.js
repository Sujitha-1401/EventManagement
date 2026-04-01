// Check if logged in and redirect if needed
document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    const userRole = localStorage.getItem('role');

    // If on public pages and logged in, redirect to dashboard if it's the index or login pages
    // We allow staying on index.html if explicitly desired, but usually we want to go to dashboard.
    // However, if the user clicked "Home", they might just want the landing page. 
    // BUT the user asked for a "Home page button... to go back to dashboard". 
    // So "Home" should effectively be "Dashboard".

    // Auto-redirect from login/signup/index
    // Auto-redirect from login/signup (but allow index.html)
    if ((window.location.pathname.endsWith('login.html') ||
        window.location.pathname.endsWith('signup.html') ||
        window.location.pathname.endsWith('login-admin.html')) && token) {

        // Only redirect if NOT explicitly logging out (which clears token anyway)
        redirectUser(userRole);
    }
});

function redirectUser(role) {
    if (role === 'student') window.location.href = 'dashboard-student.html';
    else if (role === 'club') window.location.href = 'dashboard-club.html';
    else if (role === 'admin') window.location.href = 'dashboard-admin.html';
    else window.location.href = 'index.html'; // Fallback
}

function goHome() {
    const token = getToken();
    const role = localStorage.getItem('role');
    if (token && role) {
        redirectUser(role);
    } else {
        window.location.href = 'index.html';
    }
}

function showToast(message, type = 'info') {
    alert(message);
}
