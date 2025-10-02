// Main Application Module
const App = {
    async initialize() {
        try {
            await Campaign.populateSenderAccounts();
            await App.loadTemplates();
            await App.loadDashboardData();
            // Chat.init(); // Chat disabled
            Navigation.showPage('dashboard-section', 'Dashboard');
        } catch (error) {
            console.error('App initialization failed:', error);
            // Still show the dashboard even if data loading fails
            Navigation.showPage('dashboard-section', 'Dashboard');
        }
    },

    async loadTemplates() {
        try {
            const apiTemplates = await API.getTemplates();
            Campaign.populateTemplates(apiTemplates);
        } catch (error) {
            console.error("Could not populate templates:", error);
        }
    },

    async loadDashboardData() {
        try {
            const [stats, recentEmails] = await Promise.all([
                API.getDashboardStats(),
                Auth.isAdmin() ? API.getAdminRecentEmails() : API.getRecentEmails()
            ]);

            // Safe DOM updates with null checks
            const elements = {
                'stats-today': stats.email_stats?.today || 0,
                'stats-week': stats.email_stats?.last_7_days || 0,
                'stats-month': stats.email_stats?.last_30_days || 0,
                'stats-this-month': stats.email_stats?.this_month || 0
            };

            Object.entries(elements).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });

            // Update recent campaigns section to show recent emails
            const recentCampaignsEl = document.getElementById('recent-campaigns');
            if (recentCampaignsEl) {
                recentCampaignsEl.innerHTML = '';

                if (recentEmails && recentEmails.length > 0) {
                    recentEmails.forEach(email => {
                        const div = document.createElement('div');
                        div.className = 'p-3 rounded flex justify-between items-center';
                        div.style.backgroundColor = 'var(--bg-accent)';

                        const escapeHtml = (text) => {
                            if (typeof text !== 'string') return '';
                            const div = document.createElement('div');
                            div.textContent = text;
                            return div.innerHTML;
                        };

                        const statusColor = email.status === 'sent' ? 'var(--success)' :
                            email.status === 'failed' ? 'var(--error)' : 'var(--warning)';

                        const timeAgo = email.sent_at ? new Date(email.sent_at).toLocaleString() : 'Unknown';

                        div.innerHTML = `
                            <div>
                                <p class="font-semibold text-sm" style="color: var(--text-primary)">${escapeHtml(email.recipient_email)}</p>
                                <p class="text-xs" style="color: var(--text-secondary)">${timeAgo}</p>
                            </div>
                            <span class="text-xs font-medium" style="color: ${statusColor}">${email.status}</span>
                        `;
                        recentCampaignsEl.appendChild(div);
                    });
                } else {
                    const div = document.createElement('div');
                    div.className = 'p-3 text-center';
                    div.style.color = 'var(--text-secondary)';
                    div.textContent = 'No recent emails found';
                    recentCampaignsEl.appendChild(div);
                }
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            // Show user-friendly error message
            const errorEl = document.getElementById('dashboard-error');
            if (errorEl) {
                errorEl.textContent = 'Failed to load dashboard data. Please try again.';
                errorEl.style.display = 'block';
            }
        }
    }
};

// Navigation Module
const Navigation = {
    showPage(pageId, title) {
        document.querySelectorAll('.page-section').forEach(section => section.classList.add('hidden'));
        const targetSection = document.getElementById(pageId);
        if (targetSection) targetSection.classList.remove('hidden');

        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const navLink = document.getElementById('nav-' + pageId.replace('-section', ''));
        if (navLink) navLink.classList.add('active');

        document.getElementById('page-title').textContent = title;

        if (pageId === 'templates-section') Templates.load();
        else if (pageId === 'dashboard-section') App.loadDashboardData();
        else if (pageId === 'analytics-section') Analytics.loadData();
        else if (pageId === 'campaign-section') Campaign.populateSenderAccounts();
    }
};

// Event Handlers Setup
function initializeApp() {
    console.log('Initializing app...');
    lucide.createIcons();

    // Auth events
    const loginTabManual = document.getElementById('login-tab-manual');
    const loginTabGoogle = document.getElementById('login-tab-google');
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');
    const googleLoginButton = document.getElementById('google-login-button');

    if (loginTabManual) loginTabManual.addEventListener('click', () => Auth.switchLoginTab('manual'));
    if (loginTabGoogle) loginTabGoogle.addEventListener('click', () => Auth.switchLoginTab('google'));
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Form submitted');
            Auth.handleManualLogin();
        });
    }
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            console.log('Login button clicked');
            Auth.handleManualLogin();
        });
    }
    if (googleLoginButton) googleLoginButton.addEventListener('click', Auth.handleGoogleLogin);

    // Navigation events
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.id.replace('nav-', '');

            // Check admin access
            if (page === 'admin') {
                if (!Auth.isAdmin()) {
                    console.warn('Non-admin user attempted to access admin panel');
                    return;
                }
                // Admin panel has its own open method
                if (typeof Admin !== 'undefined' && Admin.open) {
                    Admin.open();
                }
                return;
            }

            const titles = {
                'dashboard': 'Dashboard',
                'campaign': 'New Campaign',
                'templates': 'Email Templates',
                'validation': 'Email Validation',
                'analytics': 'Analytics'
            };
            Navigation.showPage(page + '-section', titles[page]);
        });
    });

    // Quick actions
    const quickNewCampaign = document.getElementById('quick-new-campaign');
    const quickManageTemplates = document.getElementById('quick-manage-templates');
    const quickValidateEmails = document.getElementById('quick-validate-emails');
    const backToDashboard = document.getElementById('back-to-dashboard');

    if (quickNewCampaign) quickNewCampaign.addEventListener('click', () => Navigation.showPage('campaign-section', 'New Campaign'));
    if (quickManageTemplates) quickManageTemplates.addEventListener('click', () => Navigation.showPage('templates-section', 'Email Templates'));
    if (quickValidateEmails) quickValidateEmails.addEventListener('click', () => Navigation.showPage('validation-section', 'Email Validation'));
    if (backToDashboard) backToDashboard.addEventListener('click', () => Navigation.showPage('dashboard-section', 'Dashboard'));

    // Campaign events
    const step1Next = document.getElementById('step1-next');
    const recipientInput = document.getElementById('recipient-input');
    const preflightChecks = document.querySelectorAll('.preflight-check');

    if (step1Next) step1Next.addEventListener('click', Campaign.handleStep1Next);
    if (recipientInput) recipientInput.addEventListener('input', Campaign.handleRecipientInput);
    preflightChecks.forEach(el => el.addEventListener('change', Campaign.checkPreflight));

    // Template events
    const createTemplateBtn = document.getElementById('create-template-btn');
    if (createTemplateBtn) createTemplateBtn.addEventListener('click', Templates.showCreateModal);

    // Validation events
    const emailsToValidate = document.getElementById('emails-to-validate');
    const validateEmailsBtn = document.getElementById('validate-emails-btn');
    const clearInputBtn = document.getElementById('clear-input-btn');
    const backToDashboardFromValidation = document.getElementById('back-to-dashboard-from-validation');

    if (emailsToValidate) emailsToValidate.addEventListener('input', Validation.updateEmailCount);
    if (validateEmailsBtn) validateEmailsBtn.addEventListener('click', Validation.handleValidate);
    if (clearInputBtn) clearInputBtn.addEventListener('click', Validation.clearInput);
    if (backToDashboardFromValidation) backToDashboardFromValidation.addEventListener('click', () => Navigation.showPage('dashboard-section', 'Dashboard'));

    // Profile events are handled by the Profile module after login

    // Sidebar toggle functionality
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarTitle = document.getElementById('sidebar-title');
    const navTexts = document.querySelectorAll('.nav-text');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            const isCollapsed = sidebar.classList.contains('w-16');

            if (isCollapsed) {
                // Expand sidebar
                sidebar.classList.remove('w-16');
                sidebar.classList.add('w-64');
                setTimeout(() => {
                    if (sidebarTitle) sidebarTitle.style.opacity = '1';
                    navTexts.forEach(text => text.style.opacity = '1');
                }, 150);
            } else {
                // Collapse sidebar
                if (sidebarTitle) sidebarTitle.style.opacity = '0';
                navTexts.forEach(text => text.style.opacity = '0');
                setTimeout(() => {
                    sidebar.classList.remove('w-64');
                    sidebar.classList.add('w-16');
                }, 150);
            }
        });
    }

    // Stats card click functionality
    const statsCards = {
        'stats-today-card': { title: 'Today\'s Performance', period: 'today', icon: 'calendar', color: 'blue' },
        'stats-week-card': { title: 'Last 7 Days Performance', period: 'week', icon: 'calendar-days', color: 'green' },
        'stats-month-card': { title: 'Last 30 Days Performance', period: 'month', icon: 'calendar-range', color: 'orange' },
        'stats-this-month-card': { title: 'This Month Performance', period: 'thisMonth', icon: 'calendar-check', color: 'purple' }
    };

    Object.entries(statsCards).forEach(([cardId, config]) => {
        const card = document.getElementById(cardId);
        if (card) {
            card.addEventListener('click', () => showStatsModal(config));
        }
    });

    // Stats modal functionality
    const statsModal = document.getElementById('stats-modal');
    const closeStatsModal = document.getElementById('close-stats-modal');
    const viewAnalytics = document.getElementById('view-analytics');

    function showStatsModal(config) {
        const modal = document.getElementById('stats-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalSubtitle = document.getElementById('modal-subtitle');
        const modalIcon = document.getElementById('modal-icon');
        const modalIconSvg = document.getElementById('modal-icon-svg');

        modalTitle.textContent = config.title;
        modalSubtitle.textContent = `Detailed breakdown for ${config.period}`;
        modalIcon.className = `p-3 rounded-xl mr-4 bg-${config.color}-500/20`;
        modalIconSvg.setAttribute('data-lucide', config.icon);
        modalIconSvg.className = `w-8 h-8 text-${config.color}-500`;

        // Get real data from dashboard stats
        const stats = {
            sent: parseInt(document.getElementById('stats-today')?.textContent || '0'),
            failed: 0, // Would need to get from API
            bounced: 0, // Would need to get from API
            rate: '95%' // Would need to calculate from API data
        };

        document.getElementById('modal-sent').textContent = stats.sent;
        document.getElementById('modal-rate').textContent = stats.rate;
        document.getElementById('modal-failed').textContent = stats.failed;
        document.getElementById('modal-bounced').textContent = stats.bounced;

        modal.classList.remove('hidden');
        lucide.createIcons();
    }

    if (closeStatsModal) {
        closeStatsModal.addEventListener('click', () => {
            statsModal.classList.add('hidden');
        });
    }

    if (viewAnalytics) {
        viewAnalytics.addEventListener('click', () => {
            statsModal.classList.add('hidden');
            Navigation.showPage('analytics-section', 'Analytics');
        });
    }

    // Close modal on outside click
    if (statsModal) {
        statsModal.addEventListener('click', (e) => {
            if (e.target === statsModal) {
                statsModal.classList.add('hidden');
            }
        });
    }



    // Admin events - loaded dynamically after login for admin users

    // Contact modal events
    const contactAdminLink = document.getElementById('contact-admin-link');
    const contactCloseBtn = document.getElementById('contact-close-btn');
    const emailAdminBtn = document.getElementById('email-admin-btn');

    if (contactAdminLink) {
        contactAdminLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('contact-modal').classList.remove('hidden');
        });
    }
    if (contactCloseBtn) contactCloseBtn.addEventListener('click', () => document.getElementById('contact-modal').classList.add('hidden'));
    if (emailAdminBtn) {
        emailAdminBtn.addEventListener('click', () => {
            const subject = encodeURIComponent('I want to do the email karya too! Please guide me further!');
            const body = encodeURIComponent('Hello Admin,\n\nI am interested in joining the email karya group. Please guide me on how to get started.\n\nThanks!');
            window.location.href = `mailto:admin@kalkiavatar.org?subject=${subject}&body=${body}`;
        });
    }

    // Initialize app based on authentication state
    console.log('Checking authentication state...');

    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    const contactAdminFlag = urlParams.get('contact_admin');

    console.log('URL params:', { tokenFromUrl: tokenFromUrl ? 'present' : 'none', contactAdminFlag });

    if (contactAdminFlag) {
        console.log('Showing contact admin modal');
        const contactModal = document.getElementById('contact-modal');
        if (contactModal) contactModal.classList.remove('hidden');
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (tokenFromUrl) {
        console.log('Token found in URL, setting and initializing app');
        Auth.setToken(tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
        Auth.loadUserDataAndInitApp().catch(error => {
            console.error('Failed to initialize app with URL token:', error);
        });
    } else if (Auth.getToken()) {
        console.log('Existing token found, initializing app');
        Auth.loadUserDataAndInitApp().catch(error => {
            console.error('Failed to initialize app with existing token:', error);
        });
    } else {
        console.log('No token found, login modal should be visible');
        // Ensure login modal is visible
        const loginModal = document.getElementById('app-login-modal');
        if (loginModal) {
            loginModal.classList.remove('hidden');
            console.log('Login modal is visible');
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Event handlers for onclick attributes
function goToStep(step) { Campaign.goToStep(step); }
function startCampaignExecution() { Campaign.startExecution(); }
function resetApp() { Campaign.reset(); }