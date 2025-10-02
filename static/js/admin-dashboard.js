// Advanced Dashboard Components for Studio Admin Panel
const AdminDashboard = {
    charts: {},
    widgets: {},

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Initialize dashboard components
    init() {
        this.createAdvancedWidgets();
        this.setupInteractiveCharts();
        this.initializeDataTables();
        this.setupCustomFilters();
    },

    // Create advanced widgets
    createAdvancedWidgets() {
        this.widgets = {
            performanceGauge: this.createPerformanceGauge(),
            realTimeGraph: this.createRealTimeGraph(),
            heatMap: this.createHeatMap(),
            alertsWidget: this.createAlertsWidget()
        };
    },

    // Performance gauge widget
    createPerformanceGauge() {
        return {
            element: document.getElementById('performance-gauge'),
            update: (value) => {
                // Simulate gauge update
                console.log(`Performance gauge updated: ${value}%`);
            }
        };
    },

    // Real-time graph widget
    createRealTimeGraph() {
        return {
            data: [],
            maxPoints: 50,
            addDataPoint: (value) => {
                const timestamp = new Date().toLocaleTimeString();
                this.widgets.realTimeGraph.data.push({ time: timestamp, value });
                if (this.widgets.realTimeGraph.data.length > this.widgets.realTimeGraph.maxPoints) {
                    this.widgets.realTimeGraph.data.shift();
                }
                this.updateRealTimeGraph();
            },
            clear: () => {
                this.widgets.realTimeGraph.data = [];
                this.updateRealTimeGraph();
            }
        };
    },

    // Update real-time graph
    updateRealTimeGraph() {
        const container = document.getElementById('real-time-graph');
        if (!container) return;

        const data = this.widgets.realTimeGraph.data;
        if (data.length === 0) return;

        // Simple ASCII-style graph for demonstration
        const maxValue = Math.max(...data.map(d => d.value));
        const graphHeight = 100;

        let graphHTML = '<div class="font-mono text-xs">';
        for (let i = graphHeight; i >= 0; i -= 10) {
            const threshold = (i / graphHeight) * maxValue;
            let line = `${threshold.toFixed(0).padStart(3)} |`;

            data.forEach(point => {
                line += point.value >= threshold ? '█' : ' ';
            });

            graphHTML += `<div>${line}</div>`;
        }
        graphHTML += '</div>';

        container.innerHTML = graphHTML;
    },

    // Heat map widget
    createHeatMap() {
        return {
            data: this.generateHeatMapData(),
            render: () => {
                const container = document.getElementById('activity-heatmap');
                if (!container) return;

                const heatMapHTML = this.renderHeatMap(this.widgets.heatMap.data);
                container.innerHTML = heatMapHTML;
            }
        };
    },

    // Generate heat map data
    generateHeatMapData() {
        const data = [];
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const hours = Array.from({ length: 24 }, (_, i) => i);

        days.forEach(day => {
            hours.forEach(hour => {
                data.push({
                    day,
                    hour,
                    value: Math.floor(Math.random() * 100)
                });
            });
        });

        return data;
    },

    // Render heat map
    renderHeatMap(data) {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let html = '<div class="grid grid-cols-25 gap-1 text-xs">';

        // Header row
        html += '<div></div>'; // Empty corner
        for (let hour = 0; hour < 24; hour++) {
            html += `<div class="text-center">${hour}</div>`;
        }

        // Data rows
        days.forEach(day => {
            html += `<div class="font-bold">${day}</div>`;
            for (let hour = 0; hour < 24; hour++) {
                const point = data.find(d => d.day === day && d.hour === hour);
                const intensity = point ? point.value : 0;
                const color = this.getHeatMapColor(intensity);
                html += `<div class="w-4 h-4 ${color} rounded" title="${day} ${hour}:00 - ${intensity}"></div>`;
            }
        });

        html += '</div>';
        return html;
    },

    // Get heat map color based on intensity
    getHeatMapColor(intensity) {
        if (intensity < 20) return 'bg-gray-100';
        if (intensity < 40) return 'bg-blue-200';
        if (intensity < 60) return 'bg-blue-400';
        if (intensity < 80) return 'bg-blue-600';
        return 'bg-blue-800';
    },

    // Alerts widget
    createAlertsWidget() {
        return {
            alerts: [],
            addAlert: (type, message, priority = 'medium') => {
                const alert = {
                    id: Date.now(),
                    type,
                    message,
                    priority,
                    timestamp: new Date().toISOString(),
                    acknowledged: false
                };
                this.widgets.alertsWidget.alerts.unshift(alert);
                this.renderAlerts();
                return alert.id;
            },
            acknowledgeAlert: (id) => {
                const alert = this.widgets.alertsWidget.alerts.find(a => a.id === id);
                if (alert) {
                    alert.acknowledged = true;
                    this.renderAlerts();
                }
            },
            clearAll: () => {
                this.widgets.alertsWidget.alerts = [];
                this.renderAlerts();
            }
        };
    },

    // Render alerts
    renderAlerts() {
        const container = document.getElementById('system-alerts');
        if (!container) return;

        const alerts = this.widgets.alertsWidget.alerts.slice(0, 10); // Show last 10

        if (alerts.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-8">No active alerts</div>';
            return;
        }

        const alertsHTML = alerts.map(alert => {
            const priorityColor = {
                low: 'border-blue-500 bg-blue-50',
                medium: 'border-yellow-500 bg-yellow-50',
                high: 'border-red-500 bg-red-50',
                critical: 'border-red-700 bg-red-100'
            }[alert.priority] || 'border-gray-500 bg-gray-50';

            const icon = {
                error: 'alert-circle',
                warning: 'alert-triangle',
                info: 'info',
                success: 'check-circle'
            }[alert.type] || 'bell';

            const alertDiv = document.createElement('div');
            alertDiv.className = `p-3 ${priorityColor} border-l-4 rounded ${alert.acknowledged ? 'opacity-50' : ''}`;
            alertDiv.dataset.alertId = alert.id;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'flex items-start justify-between';

            const leftDiv = document.createElement('div');
            leftDiv.className = 'flex items-start';

            const iconEl = document.createElement('i');
            iconEl.setAttribute('data-lucide', icon);
            const iconColor = alert.type === 'error' ? 'red' : alert.type === 'warning' ? 'yellow' : 'blue';
            iconEl.className = `w-4 h-4 mt-0.5 mr-2 text-${iconColor}-600`;

            // Safely set text content to prevent XSS
            const safeMessage = this.escapeHtml(alert.message);
            const safeTimestamp = this.escapeHtml(new Date(alert.timestamp).toLocaleString());

            const textDiv = document.createElement('div');

            const messageDiv = document.createElement('div');
            messageDiv.className = 'text-sm font-medium';
            messageDiv.textContent = safeMessage;

            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'text-xs text-gray-500 mt-1';
            timestampDiv.textContent = safeTimestamp;

            textDiv.appendChild(messageDiv);
            textDiv.appendChild(timestampDiv);

            leftDiv.appendChild(iconEl);
            leftDiv.appendChild(textDiv);

            const rightDiv = document.createElement('div');
            if (!alert.acknowledged) {
                const ackBtn = document.createElement('button');
                ackBtn.className = 'text-xs px-2 py-1 bg-white rounded border hover:bg-gray-50';
                ackBtn.textContent = 'Ack';
                ackBtn.onclick = () => this.widgets.alertsWidget.acknowledgeAlert(alert.id);
                rightDiv.appendChild(ackBtn);
            } else {
                const checkSpan = document.createElement('span');
                checkSpan.className = 'text-xs text-green-600';
                checkSpan.textContent = '✓';
                rightDiv.appendChild(checkSpan);
            }

            contentDiv.appendChild(leftDiv);
            contentDiv.appendChild(rightDiv);
            alertDiv.appendChild(contentDiv);

            return alertDiv.outerHTML;
        }).join('');

        container.innerHTML = alertsHTML;
        lucide.createIcons();
    },

    // Setup interactive charts
    setupInteractiveCharts() {
        // Placeholder for chart library integration
        console.log('Interactive charts setup - would integrate with Chart.js, D3.js, or similar');

        // Simulate chart updates
        setInterval(() => {
            if (this.widgets.realTimeGraph) {
                const value = Math.floor(Math.random() * 100);
                this.widgets.realTimeGraph.addDataPoint(value);
            }
        }, 2000);
    },

    // Initialize advanced data tables
    initializeDataTables() {
        const tables = document.querySelectorAll('[data-advanced-table]');
        tables.forEach(table => {
            this.enhanceTable(table);
        });
    },

    // Enhance table with advanced features
    enhanceTable(table) {
        const tableId = table.id;

        // Add sorting
        const headers = table.querySelectorAll('th[data-sortable]');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                this.sortTable(tableId, header.dataset.sortable);
            });
        });

        // Add row selection
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'row-selector';
            checkbox.dataset.rowIndex = index;

            const cell = document.createElement('td');
            cell.appendChild(checkbox);
            row.insertBefore(cell, row.firstChild);
        });

        // Add bulk actions toolbar
        this.addBulkActionsToolbar(table);
    },

    // Sort table
    sortTable(tableId, column) {
        try {
            const table = document.getElementById(tableId);
            if (!table) {
                console.error(`Table with ID ${tableId} not found`);
                return;
            }

            const tbody = table.querySelector('tbody');
            if (!tbody) {
                console.error('Table body not found');
                return;
            }

            const rows = Array.from(tbody.querySelectorAll('tr'));
            if (rows.length === 0) {
                console.warn('No rows found to sort');
                return;
            }

            const columnIndex = Array.from(table.querySelectorAll('th')).findIndex(th =>
                th.dataset.sortable === column
            );

            if (columnIndex === -1) {
                console.error(`Column ${column} not found`);
                return;
            }

            rows.sort((a, b) => {
                try {
                    const aValue = a.cells[columnIndex]?.textContent?.trim() || '';
                    const bValue = b.cells[columnIndex]?.textContent?.trim() || '';

                    // Try numeric sort first
                    const aNum = parseFloat(aValue);
                    const bNum = parseFloat(bValue);

                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        return aNum - bNum;
                    }

                    // Fallback to string sort
                    return aValue.localeCompare(bValue);
                } catch (error) {
                    console.error('Error comparing row values:', error);
                    return 0;
                }
            });

            // Re-append sorted rows
            rows.forEach(row => tbody.appendChild(row));
        } catch (error) {
            console.error('Error sorting table:', error);
        }
    },

    // Add bulk actions toolbar
    addBulkActionsToolbar(table) {
        const toolbar = document.createElement('div');
        toolbar.className = 'bulk-actions-toolbar hidden p-3 bg-blue-50 border-b flex items-center justify-between';
        toolbar.innerHTML = `
            <div class="flex items-center space-x-4">
                <span class="text-sm font-medium">
                    <span class="selected-count">0</span> items selected
                </span>
                <div class="flex space-x-2">
                    <button class="bulk-action-btn px-3 py-1 bg-blue-600 text-white rounded text-sm" data-action="export">
                        Export
                    </button>
                    <button class="bulk-action-btn px-3 py-1 bg-red-600 text-white rounded text-sm" data-action="delete">
                        Delete
                    </button>
                </div>
            </div>
            <button class="clear-selection text-sm text-gray-600 hover:text-gray-800">
                Clear Selection
            </button>
        `;

        table.parentNode.insertBefore(toolbar, table);

        // Handle selection changes
        const checkboxes = table.querySelectorAll('.row-selector');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateBulkActionsToolbar(table);
            });
        });

        // Handle bulk actions
        toolbar.querySelectorAll('.bulk-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const selectedIds = this.getSelectedRowIds(table);
                AdminStudio.performBulkOperation(action, selectedIds);
            });
        });

        // Handle clear selection
        toolbar.querySelector('.clear-selection').addEventListener('click', () => {
            checkboxes.forEach(cb => cb.checked = false);
            this.updateBulkActionsToolbar(table);
        });
    },

    // Update bulk actions toolbar
    updateBulkActionsToolbar(table) {
        const toolbar = table.parentNode.querySelector('.bulk-actions-toolbar');
        const selectedCount = table.querySelectorAll('.row-selector:checked').length;

        toolbar.querySelector('.selected-count').textContent = selectedCount;
        toolbar.classList.toggle('hidden', selectedCount === 0);
    },

    // Get selected row IDs
    getSelectedRowIds(table) {
        const selectedCheckboxes = table.querySelectorAll('.row-selector:checked');
        return Array.from(selectedCheckboxes).map(cb => {
            const row = cb.closest('tr');
            return row.cells[1].textContent.trim(); // Assuming ID is in second column
        });
    },

    // Setup custom filters
    setupCustomFilters() {
        const filterContainers = document.querySelectorAll('[data-filter-container]');
        filterContainers.forEach(container => {
            this.createAdvancedFilters(container);
        });
    },

    // Create advanced filters
    createAdvancedFilters(container) {
        const filtersHTML = `
            <div class="advanced-filters p-4 bg-gray-50 rounded-lg mb-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Date Range</label>
                        <select class="w-full p-2 border rounded">
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Status</label>
                        <select class="w-full p-2 border rounded">
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Category</label>
                        <select class="w-full p-2 border rounded">
                            <option value="all">All Categories</option>
                            <option value="system">System</option>
                            <option value="user">User</option>
                            <option value="email">Email</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('afterbegin', filtersHTML);
    },

    // Generate sample alerts for demonstration
    generateSampleAlerts() {
        const alertTypes = ['info', 'warning', 'error'];
        const messages = [
            'Database backup completed successfully',
            'High CPU usage detected on server',
            'Failed login attempt from suspicious IP',
            'Email queue is processing normally',
            'SSL certificate expires in 30 days',
            'New user registration spike detected'
        ];

        setInterval(() => {
            if (Math.random() > 0.7) { // 30% chance every interval
                const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
                const message = messages[Math.floor(Math.random() * messages.length)];
                const priority = Math.random() > 0.8 ? 'high' : 'medium';

                this.widgets.alertsWidget.addAlert(type, message, priority);
            }
        }, 10000); // Every 10 seconds
    }
};

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AdminDashboard.init();
    AdminDashboard.generateSampleAlerts();
});