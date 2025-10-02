// System Settings Implementation
class SystemSettings {
    constructor() {
        this.settings = {
            session_timeout: 30,
            max_login_attempts: 5,
            lockout_duration: 15,
            max_campaign_history: 180
        };
        this.init();
    }

    init() {
        this.loadSettings();
        this.bindEvents();
    }

    loadSettings() {
        // Load from localStorage or use defaults
        const saved = localStorage.getItem('system_settings');
        if (saved) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            } catch (error) {
                console.error('Failed to parse saved settings:', error);
                localStorage.removeItem('system_settings');
            }
        }
        this.populateForm();
    }

    populateForm() {
        const sessionTimeout = document.getElementById('admin-session-timeout');
        const maxLoginAttempts = document.getElementById('admin-max-login-attempts');
        const lockoutDuration = document.getElementById('admin-lockout-duration');
        const maxCampaignHistory = document.getElementById('admin-max-campaign-history');

        if (sessionTimeout) sessionTimeout.value = this.settings.session_timeout;
        if (maxLoginAttempts) maxLoginAttempts.value = this.settings.max_login_attempts;
        if (lockoutDuration) lockoutDuration.value = this.settings.lockout_duration;
        if (maxCampaignHistory) maxCampaignHistory.value = this.settings.max_campaign_history;
    }

    bindEvents() {
        // Save settings button - check both possible IDs
        const saveBtn = document.getElementById('save-system-settings') || document.getElementById('admin-save-system-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Reset settings button - check both possible IDs  
        const resetBtn = document.getElementById('reset-system-settings') || document.getElementById('admin-reset-to-defaults');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }

        // Refresh monitoring button
        const refreshBtn = document.getElementById('refresh-monitoring');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.updateMonitoring());
        }
    }

    saveSettings() {
        const sessionTimeout = document.getElementById('admin-session-timeout');
        const maxLoginAttempts = document.getElementById('admin-max-login-attempts');
        const lockoutDuration = document.getElementById('admin-lockout-duration');
        const maxCampaignHistory = document.getElementById('admin-max-campaign-history');

        if (!sessionTimeout || !maxLoginAttempts || !lockoutDuration || !maxCampaignHistory) {
            this.showMessage('Settings form not found!', 'error');
            return;
        }

        // Validate and save settings
        this.settings = {
            session_timeout: Math.max(5, Math.min(1440, parseInt(sessionTimeout.value) || 30)),
            max_login_attempts: Math.max(3, Math.min(10, parseInt(maxLoginAttempts.value) || 5)),
            lockout_duration: Math.max(5, Math.min(1440, parseInt(lockoutDuration.value) || 15)),
            max_campaign_history: Math.max(30, Math.min(365, parseInt(maxCampaignHistory.value) || 180))
        };

        // Save to localStorage
        localStorage.setItem('system_settings', JSON.stringify(this.settings));
        
        // Update form with validated values
        sessionTimeout.value = this.settings.session_timeout;
        maxLoginAttempts.value = this.settings.max_login_attempts;
        lockoutDuration.value = this.settings.lockout_duration;
        maxCampaignHistory.value = this.settings.max_campaign_history;
        
        // Show success message
        this.showMessage('Settings saved successfully!', 'success');
    }

    resetSettings() {
        this.settings = {
            session_timeout: 30,
            max_login_attempts: 5,
            lockout_duration: 15,
            max_campaign_history: 180
        };
        
        localStorage.removeItem('system_settings');
        this.populateForm();
        this.showMessage('Settings reset to defaults!', 'info');
    }

    updateMonitoring() {
        // Update system uptime
        const uptimeEl = document.getElementById('system-uptime');
        if (uptimeEl) {
            const uptimeMs = performance.now();
            const uptimeSeconds = Math.floor(uptimeMs / 1000);
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            uptimeEl.textContent = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }

        // Update system status
        const statusEl = document.getElementById('system-status');
        if (statusEl) {
            statusEl.textContent = 'Online';
            statusEl.className = 'text-2xl font-bold text-green-600';
        }

        this.showMessage('System monitoring refreshed!', 'info');
    }

    showMessage(message, type = 'info') {
        // Use Admin notification system if available
        if (typeof Admin !== 'undefined' && Admin.showNotification) {
            Admin.showNotification(message, type);
            return;
        }

        // Fallback to custom notification
        let msgEl = document.getElementById('settings-message');
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.id = 'settings-message';
            msgEl.className = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50';
            document.body.appendChild(msgEl);
        }

        msgEl.textContent = message;
        msgEl.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;

        setTimeout(() => {
            if (msgEl.parentNode) {
                msgEl.parentNode.removeChild(msgEl);
            }
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize SystemSettings when admin system tab is available
    if (document.getElementById('admin-system')) {
        window.SystemSettingsInstance = new SystemSettings();
    }
});

// Also initialize when admin panel is opened
if (typeof Admin !== 'undefined') {
    const originalSwitchTab = Admin.switchTab;
    Admin.switchTab = function(tabName) {
        originalSwitchTab.call(this, tabName);
        if (tabName === 'system' && !window.SystemSettingsInstance) {
            window.SystemSettingsInstance = new SystemSettings();
        }
    };
}