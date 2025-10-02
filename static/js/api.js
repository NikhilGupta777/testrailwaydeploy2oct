// API Module
const API = {
    async fetch(url, options = {}) {
        const token = Auth.getToken();
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Validate URL to prevent SSRF
        if (!url || typeof url !== 'string') {
            throw new Error('Invalid URL provided');
        }

        // Ensure URL starts with / for relative paths
        if (!url.startsWith('/')) {
            throw new Error('Only relative URLs are allowed');
        }

        // Sanitize URL to prevent path traversal
        const sanitizedUrl = url.replace(/\.\./g, '').replace(/\/+/g, '/');

        console.log(`API Request: ${options.method || 'GET'} ${CONFIG.BACKEND_URL}${sanitizedUrl}`);

        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}${sanitizedUrl}`, { ...options, headers });
            console.log(`API Response: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                if (response.status === 401) {
                    console.log('Unauthorized - clearing auth');
                    Auth.clearAuth();
                    throw new Error('Session expired. Please log in again.');
                }
                let errorData;
                try {
                    errorData = await response.json();
                    console.log('Error response data:', errorData);
                } catch (jsonError) {
                    console.log('Could not parse error response as JSON');
                    throw new Error(response.statusText || 'Request failed');
                }
                throw new Error(errorData.detail || 'Request failed');
            }

            if (response.status === 204) return null;
            const data = await response.json();
            console.log('API Response data:', data);
            return data;
        } catch (error) {
            console.error('API fetch error:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Please check your connection and try again.');
            }
            throw error;
        }
    },

    async sendEmail(fromEmail, toEmail, subject, body) {
        return await API.fetch('/api/send-email', {
            method: 'POST',
            body: JSON.stringify({ from_email: fromEmail, to_email: toEmail, subject: subject, body: body })
        });
    },

    async sendEmailWithSendGridTemplate(fromEmail, toEmail, subject, sendgridTemplateId, dynamicData, templateId) {
        return await API.fetch('/api/send-email', {
            method: 'POST',
            body: JSON.stringify({
                from_email: fromEmail,
                to_email: toEmail,
                subject: subject,
                sendgrid_template_id: sendgridTemplateId,
                dynamic_template_data: dynamicData,
                template_id: templateId
            })
        });
    },

    async sendEmailWithTemplate(fromEmail, toEmail, subject, body, templateId) {
        return await API.fetch('/api/send-email', {
            method: 'POST',
            body: JSON.stringify({
                from_email: fromEmail,
                to_email: toEmail,
                subject: subject,
                body: body,
                template_id: templateId
            })
        });
    },

    async sendEmailWithTemplate(fromEmail, toEmail, subject, body, templateId) {
        return await API.fetch('/api/send-email', {
            method: 'POST',
            body: JSON.stringify({ from_email: fromEmail, to_email: toEmail, subject: subject, body: body, template_id: templateId })
        });
    },

    async sendEmailWithSendGridTemplate(fromEmail, toEmail, subject, sendgridTemplateId, dynamicData, templateId) {
        return await API.fetch('/api/send-email', {
            method: 'POST',
            body: JSON.stringify({
                from_email: fromEmail,
                to_email: toEmail,
                subject: subject,
                sendgrid_template_id: sendgridTemplateId,
                dynamic_template_data: dynamicData,
                template_id: templateId
            })
        });
    },

    async validateEmails(emails) {
        return await API.fetch('/email/validate', {
            method: 'POST',
            body: JSON.stringify({ emails: emails })
        });
    },

    async getTemplates() {
        return await API.fetch('/templates');
    },

    async createTemplate(template) {
        return await API.fetch('/templates', {
            method: 'POST',
            body: JSON.stringify(template)
        });
    },

    async updateTemplate(templateId, updates) {
        return await API.fetch(`/templates/${templateId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    async deleteTemplate(templateId) {
        return await API.fetch(`/templates/${templateId}`, { method: 'DELETE' });
    },

    async getDashboardStats() {
        return await API.fetch('/dashboard/stats');
    },

    async getAnalytics() {
        return await API.fetch('/analytics');
    },

    async getChatUsers() {
        return await API.fetch('/chat/users');
    },

    async sendChatMessage(message, recipientId = null, roomId = null) {
        return await API.fetch('/chat/messages', {
            method: 'POST',
            body: JSON.stringify({
                message: message,
                recipient_id: recipientId,
                room_id: roomId,
                message_type: 'text'
            })
        });
    },

    async getChatMessages(roomId = 'global', limit = 50, offset = 0) {
        const params = new URLSearchParams({
            room_id: roomId,
            limit: limit.toString(),
            offset: offset.toString()
        });
        return await API.fetch(`/chat/messages?${params}`);
    },

    // Admin API endpoints
    async getAdminOverview() {
        return await API.fetch('/admin/overview');
    },

    async getAllUsers() {
        return await API.fetch('/admin/users');
    },

    async getDetailedUsers() {
        try {
            const users = await API.fetch('/admin/users/detailed');
            if (!Array.isArray(users)) {
                console.error('Invalid users data received:', users);
                return [];
            }
            return users;
        } catch (error) {
            console.error('Failed to get detailed users:', error);
            throw new Error('Failed to load user data: ' + (error.message || 'Network error'));
        }
    },

    async createUserAdmin(userData) {
        return await API.fetch('/admin/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    async updateUserAdmin(userId, userData) {
        return await API.fetch(`/admin/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    },

    async deleteUserAdmin(userId) {
        return await API.fetch(`/admin/users/${userId}`, { method: 'DELETE' });
    },

    async getEmailLogs(statusFilter = null, limit = 100, offset = 0) {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString()
        });
        if (statusFilter && statusFilter !== 'all') {
            params.append('status_filter', statusFilter);
        }
        return await API.fetch(`/admin/email-logs?${params}`);
    },

    async getAdminCampaigns() {
        return await API.fetch('/admin/campaigns');
    },

    async getAdminTemplates() {
        return await API.fetch('/admin/templates');
    },

    async deleteTemplateAdmin(templateId) {
        return await API.fetch(`/admin/templates/${templateId}`, { method: 'DELETE' });
    },

    async deleteAdminCampaign(campaignId) {
        return await API.fetch(`/admin/campaigns/${campaignId}`, { method: 'DELETE' });
    },

    async cleanupSystemData(cleanupType) {
        return await API.fetch('/admin/system/cleanup', {
            method: 'POST',
            body: JSON.stringify({ type: cleanupType })
        });
    },

    async getDatabaseStats() {
        return await API.fetch('/admin/database/stats');
    },

    async saveSystemSettings(settings) {
        return await API.fetch('/admin/system/settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    },

    async getSystemSettings() {
        return await API.fetch('/admin/system/settings');
    },

    // Resend failed email
    async resendEmail(logId) {
        return await API.fetch(`/admin/email-logs/${logId}/resend`, {
            method: 'POST'
        });
    },

    // Test email configuration
    async testEmailConfig() {
        return await API.fetch('/admin/system/test-email', {
            method: 'POST'
        });
    },

    // Profile management
    async updateProfile(userData) {
        return await API.fetch('/users/me/update', {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    },

    async changePassword(passwordData) {
        return await API.fetch('/users/me/change-password', {
            method: 'PUT',
            body: JSON.stringify(passwordData)
        });
    },

    // User email management
    async getUserEmails(userId) {
        try {
            return await API.fetch(`/admin/users/${userId}/emails`);
        } catch (error) {
            console.error('Failed to get user emails:', error);
            // Return empty array on error to prevent crashes
            return [];
        }
    },

    async addUserEmail(userId, emailData) {
        return await API.fetch(`/admin/users/${userId}/emails`, {
            method: 'POST',
            body: JSON.stringify(emailData)
        });
    },

    async removeUserEmail(userId, emailId) {
        return await API.fetch(`/admin/users/${userId}/emails/${emailId}`, {
            method: 'DELETE'
        });
    },

    async getMyEmails() {
        return await API.fetch('/users/me/emails');
    },

    // Security endpoints
    async getSecurityOverview() {
        return await API.fetch('/admin/security/overview');
    },

    async forceLogoutAllUsers() {
        return await API.fetch('/admin/security/force-logout-all', {
            method: 'POST'
        });
    },

    async resetAllPasswords() {
        return await API.fetch('/admin/security/reset-passwords', {
            method: 'POST'
        });
    },

    async getAuditLog(limit = 50) {
        return await API.fetch(`/admin/security/audit-log?limit=${limit}`);
    },

    async clearSecurityAlerts() {
        return await API.fetch('/admin/security/clear-alerts', {
            method: 'POST'
        });
    },

    async clearAuditLogs() {
        return await API.fetch('/admin/security/clear-logs', {
            method: 'POST'
        });
    },

    async getUserActivity(limit = 100) {
        return await API.fetch(`/admin/security/user-activity?limit=${limit}`);
    },

    // Recent emails for dashboard
    async getRecentEmails() {
        return await API.fetch('/dashboard/recent-emails');
    },

    async getAdminRecentEmails() {
        return await API.fetch('/admin/recent-emails');
    },

    // Send email to users
    async sendEmailToUsers(emailData) {
        const results = [];
        for (const userId of emailData.user_ids) {
            try {
                const result = await this.sendEmail('admin@kalkiavatar.org', `user${userId}@example.com`, emailData.subject, emailData.content);
                results.push({ userId, success: true });
            } catch (error) {
                results.push({ userId, success: false, error: error.message });
            }
        }
        return { sent_count: results.filter(r => r.success).length, results };
    },

    // Admin template management
    async createTemplateAdmin(template) {
        return await API.fetch('/admin/templates', {
            method: 'POST',
            body: JSON.stringify(template)
        });
    },

    async updateTemplateAdmin(templateId, updates) {
        return await API.fetch(`/admin/templates/${templateId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    // Campaign email sending methods
    async sendEmailWithSendGridTemplate(fromEmail, toEmail, subject, templateId, dynamicData, campaignTemplateId) {
        return await API.fetch('/api/send-email', {
            method: 'POST',
            body: JSON.stringify({
                from_email: fromEmail,
                to_email: toEmail,
                subject: subject,
                template_id: templateId,
                dynamic_template_data: dynamicData,
                campaign_template_id: campaignTemplateId
            })
        });
    },

    async sendEmailWithTemplate(fromEmail, toEmail, subject, body, campaignTemplateId) {
        return await API.fetch('/api/send-email', {
            method: 'POST',
            body: JSON.stringify({
                from_email: fromEmail,
                to_email: toEmail,
                subject: subject,
                body: body,
                campaign_template_id: campaignTemplateId
            })
        });
    },

    // Admin email management
    async resendEmail(logId) {
        return await API.fetch(`/admin/email-logs/${logId}/resend`, {
            method: 'POST'
        });
    },

    async sendEmailToUsers(emailData) {
        return await API.fetch('/admin/send-email-to-users', {
            method: 'POST',
            body: JSON.stringify(emailData)
        });
    }
};