// Studio-Level Admin Panel Enhancement
const AdminStudio = {
    // Real-time monitoring
    liveUpdates: true,
    updateInterval: null,
    activityFeed: [],
    
    // Initialize studio features
    init() {
        this.startRealTimeUpdates();
        this.initializeCharts();
        this.setupWebSocket();
        this.bindStudioEvents();
    },

    // Real-time updates
    startRealTimeUpdates() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            if (this.liveUpdates) {
                this.updateLiveMetrics();
                this.updateActivityFeed();
            }
        }, 5000);
    },

    // Live metrics update
    async updateLiveMetrics() {
        try {
            const metrics = await this.fetchLiveMetrics();
            this.updateMetricCards(metrics);
            this.updatePerformanceCharts(metrics);
        } catch (error) {
            console.error('Failed to update live metrics:', error);
        }
    },

    // Fetch live metrics
    async fetchLiveMetrics() {
        return {
            activeUsers: Math.floor(Math.random() * 200) + 50,
            emailsPerMin: Math.floor(Math.random() * 50) + 10,
            apiCallsPerMin: Math.floor(Math.random() * 300) + 100,
            errorRate: (Math.random() * 2).toFixed(1),
            cpuUsage: Math.floor(Math.random() * 30) + 40,
            memoryUsage: Math.floor(Math.random() * 20) + 55,
            diskUsage: Math.floor(Math.random() * 10) + 75
        };
    },

    // Update metric cards
    updateMetricCards(metrics) {
        const cards = {
            'active-users': metrics.activeUsers,
            'emails-per-min': metrics.emailsPerMin,
            'api-calls-per-min': metrics.apiCallsPerMin,
            'error-rate': metrics.errorRate + '%'
        };

        Object.entries(cards).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.classList.add('animate-pulse');
                setTimeout(() => element.classList.remove('animate-pulse'), 1000);
            }
        });
    },

    // Activity feed simulation
    updateActivityFeed() {
        const activities = [
            'User logged in from 192.168.1.100',
            'Email campaign #456 started',
            'Database backup completed',
            'New user registered: john@example.com',
            'Template "Welcome Email" updated',
            'System health check passed',
            'Email sent to customer@domain.com',
            'API rate limit warning for user #123'
        ];

        const activity = {
            message: activities[Math.floor(Math.random() * activities.length)],
            timestamp: new Date().toLocaleTimeString(),
            type: Math.random() > 0.8 ? 'warning' : 'info'
        };

        this.addActivityToFeed(activity);
    },

    // Add activity to live feed
    addActivityToFeed(activity) {
        const feedElement = document.getElementById('live-activity-stream');
        if (!feedElement) return;

        const activityDiv = document.createElement('div');
        activityDiv.className = `p-2 rounded border-l-4 ${
            activity.type === 'warning' ? 'bg-yellow-50 border-yellow-400' : 'bg-blue-50 border-blue-400'
        } animate-fade-in`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'flex items-center justify-between';
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'text-sm';
        messageSpan.textContent = activity.message;
        
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'text-xs text-gray-500';
        timestampSpan.textContent = activity.timestamp;
        
        contentDiv.appendChild(messageSpan);
        contentDiv.appendChild(timestampSpan);
        activityDiv.appendChild(contentDiv);

        feedElement.insertBefore(activityDiv, feedElement.firstChild);
        
        // Keep only last 50 items
        while (feedElement.children.length > 50) {
            feedElement.removeChild(feedElement.lastChild);
        }
    },

    // Emergency actions
    async emergencyStop() {
        if (!confirm('⚠️ EMERGENCY STOP\n\nThis will immediately halt all email sending and put the system in maintenance mode.\n\nAre you absolutely sure?')) {
            return;
        }

        try {
            await API.fetch('/admin/emergency/stop', { method: 'POST' });
            this.showCriticalAlert('🚨 EMERGENCY STOP ACTIVATED', 'All email operations have been halted. System is now in emergency mode.');
        } catch (error) {
            this.showCriticalAlert('❌ EMERGENCY STOP FAILED', 'Could not activate emergency stop: ' + error.message);
        }
    },

    // Maintenance mode
    async maintenanceMode() {
        if (!confirm('🔧 MAINTENANCE MODE\n\nThis will put the system in maintenance mode and prevent new operations.\n\nContinue?')) {
            return;
        }

        try {
            await API.fetch('/admin/maintenance/enable', { method: 'POST' });
            this.showCriticalAlert('🔧 MAINTENANCE MODE ACTIVE', 'System is now in maintenance mode. New operations are disabled.');
        } catch (error) {
            this.showCriticalAlert('❌ MAINTENANCE MODE FAILED', 'Could not enable maintenance mode: ' + error.message);
        }
    },

    // Critical alert system
    showCriticalAlert(title, message) {
        const alert = document.createElement('div');
        alert.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
        const alertContent = document.createElement('div');
        alertContent.className = 'bg-red-600 text-white p-8 rounded-lg max-w-md mx-4 text-center';
        
        const titleEl = document.createElement('h2');
        titleEl.className = 'text-2xl font-bold mb-4';
        titleEl.textContent = title;
        
        const messageEl = document.createElement('p');
        messageEl.className = 'mb-6';
        messageEl.textContent = message;
        
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.className = 'bg-white text-red-600 px-6 py-2 rounded font-bold';
        acknowledgeBtn.textContent = 'ACKNOWLEDGE';
        acknowledgeBtn.onclick = () => alert.remove();
        
        alertContent.appendChild(titleEl);
        alertContent.appendChild(messageEl);
        alertContent.appendChild(acknowledgeBtn);
        alert.appendChild(alertContent);
        document.body.appendChild(alert);
    },

    // Advanced search and filtering
    setupAdvancedSearch() {
        const searchInputs = document.querySelectorAll('[data-advanced-search]');
        searchInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.performAdvancedSearch(e.target.dataset.advancedSearch, e.target.value);
            });
        });
    },

    // Perform advanced search
    performAdvancedSearch(tableId, query) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');
        const terms = query.toLowerCase().split(' ');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const matches = terms.every(term => text.includes(term));
            row.style.display = matches ? '' : 'none';
        });
    },

    // Bulk operations
    async performBulkOperation(operation, selectedIds) {
        if (selectedIds.length === 0) {
            Admin.showNotification('No items selected', 'warning');
            return;
        }

        const confirmMessage = `Perform ${operation} on ${selectedIds.length} selected items?`;
        if (!confirm(confirmMessage)) return;

        
        try {
            await API.fetch('/admin/bulk-operations', {
                method: 'POST',
                body: JSON.stringify({ operation, ids: selectedIds })
            });
            Admin.showNotification(`Bulk ${operation} completed successfully!`);
        } catch (error) {
            Admin.showNotification(`Bulk ${operation} failed: ` + error.message, 'error');
        }
    },

    // Data export with advanced options
    async exportAdvanced(type, options = {}) {
        try {
            const response = await API.fetch('/admin/export/advanced', {
                method: 'POST',
                body: JSON.stringify({ type, options })
            });

            const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Admin.showNotification('Advanced export completed!');
        } catch (error) {
            Admin.showNotification('Export failed: ' + error.message, 'error');
        }
    },

    // System health monitoring
    async checkSystemHealth() {
        try {
            const health = await API.fetch('/admin/health/comprehensive');
            this.updateHealthIndicators(health);
            return health;
        } catch (error) {
            console.error('Health check failed:', error);
            this.updateHealthIndicators({ status: 'error', message: error.message });
        }
    },

    // Update health indicators
    updateHealthIndicators(health) {
        const indicators = {
            'server-status': health.server || 'unknown',
            'db-status': health.database || 'unknown',
            'email-status': health.email || 'unknown'
        };

        Object.entries(indicators).forEach(([id, status]) => {
            const element = document.getElementById(id);
            if (element) {
                element.className = `w-3 h-3 rounded-full mr-2 ${
                    status === 'healthy' ? 'bg-green-500 animate-pulse' :
                    status === 'warning' ? 'bg-yellow-500 animate-pulse' :
                    'bg-red-500 animate-pulse'
                }`;
            }
        });
    },

    // Initialize charts (placeholder for chart library integration)
    initializeCharts() {
        console.log('Charts initialized - would integrate with Chart.js or similar');
    },

    // WebSocket setup for real-time updates
    setupWebSocket() {
        // Placeholder for WebSocket implementation
        console.log('WebSocket setup - would connect to real-time server');
    },

    // Bind studio-specific events
    bindStudioEvents() {
        // Toggle activity feed
        const toggleBtn = document.getElementById('toggle-activity-feed');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.liveUpdates = !this.liveUpdates;
                toggleBtn.innerHTML = this.liveUpdates ? 
                    '<i data-lucide="pause" class="w-4 h-4"></i>' : 
                    '<i data-lucide="play" class="w-4 h-4"></i>';
                lucide.createIcons();
            });
        }

        // Refresh overview
        const refreshBtn = document.getElementById('refresh-overview');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                Admin.loadOverview();
                this.checkSystemHealth();
            });
        }

        // Export overview
        const exportBtn = document.getElementById('export-overview');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportAdvanced('overview', { includeMetrics: true, timeframe: '24h' });
            });
        }
    },

    // Cleanup
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
};

// Extend the main Admin object with studio features
Object.assign(Admin, {
    // Studio-level methods
    toggleActivityFeed() {
        AdminStudio.liveUpdates = !AdminStudio.liveUpdates;
        const btn = event.target.closest('button');
        btn.innerHTML = AdminStudio.liveUpdates ? 
            '<i data-lucide="pause" class="w-4 h-4"></i>' : 
            '<i data-lucide="play" class="w-4 h-4"></i>';
        lucide.createIcons();
    },

    emergencyStop() {
        AdminStudio.emergencyStop();
    },

    maintenanceMode() {
        AdminStudio.maintenanceMode();
    },

    // Enhanced switch tab with studio features
    switchTab(tabName) {
        // Call original switchTab
        document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(`admin-${tabName}`).classList.remove('hidden');
        this.currentTab = tabName;

        // Load data for the selected tab
        switch (tabName) {
            case 'overview':
                this.loadOverview();
                AdminStudio.checkSystemHealth();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'monitoring':
                AdminStudio.startRealTimeUpdates();
                break;
            case 'logs':
                this.loadSystemLogs();
                break;
            case 'api':
                this.loadApiStats();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'emails':
                this.loadEmailLogs();
                break;
            case 'campaigns':
                this.loadCampaigns();
                break;
            case 'templates':
                this.loadTemplates();
                break;
            case 'system':
                this.loadSystemInfo();
                break;
            case 'security':
                this.loadSecurityOverview();
                break;
            case 'database':
                this.loadDatabaseStats();
                break;
        }
    },

    // New methods for studio features
    async loadAnalytics() {
        console.log('Loading advanced analytics...');
        // Implementation would load comprehensive analytics data
    },

    async loadSystemLogs() {
        console.log('Loading system logs...');
        // Implementation would load and display system logs
    },

    async loadApiStats() {
        console.log('Loading API statistics...');
        // Implementation would load API usage statistics
    },

    // Load security overview
    async loadSecurityOverview() {
        try {
            const data = await API.getSecurityOverview();
            
            // Update security overview stats
            document.getElementById('admin-failed-logins').textContent = data.failed_logins || 0;
            document.getElementById('admin-active-sessions').textContent = data.active_sessions || 0;
            document.getElementById('admin-security-alerts').textContent = data.security_alerts || 0;
            
            // Load security alerts table
            this.loadSecurityAlerts(data.recent_alerts || []);
            
            // Bind security action buttons
            this.bindSecurityActions();
        } catch (error) {
            console.error('Failed to load security overview:', error);
            this.showNotification('Failed to load security data', 'error');
        }
    },

    // Load security alerts into table
    loadSecurityAlerts(alerts) {
        const tbody = document.getElementById('security-alerts-table');
        
        if (!alerts || alerts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-500"><i data-lucide="shield-check" class="w-12 h-12 mx-auto mb-2 opacity-50"></i><p>No security alerts</p></td></tr>';
            lucide.createIcons();
            return;
        }
        
        tbody.innerHTML = '';
        
        alerts.forEach(alert => {
            const row = document.createElement('tr');
            
            const typeColors = {
                'failed_login': 'bg-red-100 text-red-800',
                'suspicious': 'bg-orange-100 text-orange-800',
                'brute_force': 'bg-red-100 text-red-800',
                'rate_limit': 'bg-yellow-100 text-yellow-800',
                'data_access': 'bg-purple-100 text-purple-800',
                'malware': 'bg-red-100 text-red-800',
                'privilege': 'bg-orange-100 text-orange-800',
                'session': 'bg-blue-100 text-blue-800'
            };
            
            const statusColors = {
                'high': 'bg-red-100 text-red-800',
                'medium': 'bg-yellow-100 text-yellow-800',
                'low': 'bg-green-100 text-green-800',
                'critical': 'bg-red-200 text-red-900'
            };
            
            const timestamp = new Date(alert.timestamp).toLocaleString();
            const typeColor = typeColors[alert.type] || 'bg-gray-100 text-gray-800';
            const statusColor = statusColors[alert.severity] || 'bg-gray-100 text-gray-800';
            
            row.innerHTML = `
                <td class="py-3 px-4 text-sm text-gray-900">${timestamp}</td>
                <td class="py-3 px-4"><span class="px-2 py-1 ${typeColor} rounded text-xs">${alert.type.replace('_', ' ')}</span></td>
                <td class="py-3 px-4 text-sm text-gray-900">${Security.escapeHtml(alert.message)}</td>
                <td class="py-3 px-4 text-sm text-gray-900">N/A</td>
                <td class="py-3 px-4"><span class="px-2 py-1 ${statusColor} rounded text-xs">${alert.severity}</span></td>
                <td class="py-3 px-4"><button class="text-blue-600 hover:text-blue-800 text-sm">Review</button></td>
            `;
            
            tbody.appendChild(row);
        });
        
        lucide.createIcons();
    },

    // Bind security action buttons
    bindSecurityActions() {
        // Force logout all users
        const forceLogoutBtn = document.getElementById('admin-force-logout-all');
        if (forceLogoutBtn) {
            forceLogoutBtn.onclick = async () => {
                if (confirm('Are you sure you want to force logout all users? This will terminate all active sessions.')) {
                    try {
                        const result = await API.forceLogoutAllUsers();
                        this.showNotification(result.message, 'success');
                        this.loadSecurityOverview(); // Refresh data
                    } catch (error) {
                        this.showNotification('Failed to force logout users: ' + error.message, 'error');
                    }
                }
            };
        }

        // Reset all passwords
        const resetPasswordsBtn = document.getElementById('admin-reset-passwords');
        if (resetPasswordsBtn) {
            resetPasswordsBtn.onclick = async () => {
                if (confirm('⚠️ WARNING: This will initiate password reset for ALL users. Are you absolutely sure?')) {
                    try {
                        const result = await API.resetAllPasswords();
                        this.showNotification(result.message, 'success');
                        this.loadSecurityOverview(); // Refresh data
                    } catch (error) {
                        this.showNotification('Failed to reset passwords: ' + error.message, 'error');
                    }
                }
            };
        }

        // Refresh security alerts
        const refreshAlertsBtn = document.getElementById('refresh-security-alerts');
        if (refreshAlertsBtn) {
            refreshAlertsBtn.onclick = () => {
                this.loadSecurityOverview();
            };
        }
    },

    // Override init to include studio features
    init() {
        this.bindEvents();
        this.loadOverview();
        this.startAutoRefresh();
        AdminStudio.init(); // Initialize studio features
    },

    // Override close to cleanup studio features
    close() {
        document.getElementById('admin-panel-modal').classList.add('hidden');
        this.stopAutoRefresh();
        AdminStudio.destroy(); // Cleanup studio features
    }
});

// CSS for animations and studio features
const studioStyles = `
<style>
.animate-fade-in {
    animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}

.admin-tab.active {
    background-color: var(--bg-accent);
    color: var(--text-primary);
    border-bottom: 2px solid var(--text-accent);
}

.admin-tab:hover {
    background-color: var(--bg-secondary);
    transition: all 0.2s ease;
}

.metric-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.metric-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}

.progress-bar {
    transition: width 0.3s ease;
}

.status-indicator {
    position: relative;
}

.status-indicator::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
}
</style>
`;

// Inject studio styles
document.head.insertAdjacentHTML('beforeend', studioStyles);