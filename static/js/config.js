// Configuration and Constants
const CONFIG = {
    // Make backend URL configurable via environment or meta tag
    BACKEND_URL: (function() {
        // Try to get from meta tag first (server-side rendered)
        const metaTag = document.querySelector('meta[name="backend-url"]');
        if (metaTag && metaTag.content) {
            return metaTag.content;
        }
        // Fallback to localhost for development
        return window.location.protocol + '//' + window.location.hostname + ':8000';
    })(),
    TOKEN_KEY: 'auth_token',
    // Google client ID should be configured server-side
    GOOGLE_CLIENT_ID: (function() {
        const metaTag = document.querySelector('meta[name="google-client-id"]');
        return metaTag ? metaTag.content : '';
    })()
};

// Initialize Google Client ID when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const googleOnload = document.getElementById('g_id_onload');
        if (googleOnload && CONFIG.GOOGLE_CLIENT_ID !== 'your-google-client-id-here') {
            googleOnload.setAttribute('data-client_id', CONFIG.GOOGLE_CLIENT_ID);
        }
    });
}

// Application state management (avoiding global variables)
const AppState = {
    // Current campaign state
    currentState: { currentStep: 1, sender: null, template: null, recipients: [] },

    // User data
    userData: null,

    // Available sender accounts
    SENDER_ACCOUNTS: [],

    // Initialize state
    init() {
        this.SENDER_ACCOUNTS = [
            { id: 2, email: 'info@bhavishyamalika.com', name: 'Bhavishya Malika Info', type: 'work' },
            { id: 3, email: 'admin@kalkiavatar.org', name: 'Kalki Avatar Admin', type: 'work' }
        ];
    },

    // Reset campaign state
    resetCampaign() {
        this.currentState = { currentStep: 1, sender: null, template: null, recipients: [] };
    },

    // Clear user data
    clearUserData() {
        this.userData = null;
        this.SENDER_ACCOUNTS = [];
    }
};

// Initialize state when DOM is ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        AppState.init();
    });
}