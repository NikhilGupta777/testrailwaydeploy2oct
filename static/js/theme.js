// Theme Management System
const ThemeManager = {
    currentTheme: 'light',

    init() {
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);

        // Setup event listeners
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.cycleTheme();
            });
        }

        // Theme select dropdown
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
            });
        }
    },

    cycleTheme() {
        const themes = ['light', 'dark'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.setTheme(themes[nextIndex]);
    },

    setTheme(theme) {
        this.currentTheme = theme;

        // Update document attribute
        document.documentElement.setAttribute('data-theme', theme);

        // Save to localStorage
        localStorage.setItem('theme', theme);

        // Update UI elements
        this.updateUI(theme);

        // Update admin panel if it's open
        this.updateAdminPanelTheme(theme);

        // Dispatch theme change event
        document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));

        // Update profile system if available
        if (typeof EnhancedProfile !== 'undefined' && EnhancedProfile.updateAvatarColors) {
            EnhancedProfile.updateAvatarColors();
        }
    },

    // Update admin panel theme
    updateAdminPanelTheme(theme) {
        const adminSection = document.getElementById('admin-section');
        if (!adminSection || adminSection.classList.contains('hidden')) {
            return;
        }

        // Apply theme to admin panel if Admin object is available
        if (typeof Admin !== 'undefined' && Admin.applyThemeToAdminPanel) {
            setTimeout(() => Admin.applyThemeToAdminPanel(), 100);
        }

        // Force update admin tab styling
        this.updateAdminTabStyling(theme);
    },

    // Update admin tab styling based on theme
    updateAdminTabStyling(theme) {
        const isDark = theme === 'dark';
        const adminTabs = document.querySelectorAll('.admin-tab');

        adminTabs.forEach(tab => {
            if (tab.classList.contains('active')) {
                if (isDark) {
                    tab.style.color = 'var(--text-accent)';
                    tab.style.borderBottomColor = 'var(--text-accent)';
                    tab.style.backgroundColor = 'var(--bg-accent)';
                } else {
                    tab.style.color = '';
                    tab.style.borderBottomColor = '';
                    tab.style.backgroundColor = '';
                }
            } else {
                if (isDark) {
                    tab.style.color = 'var(--admin-text-secondary)';
                } else {
                    tab.style.color = '';
                }
            }
        });
    },

    updateUI(theme) {
        // Update theme select
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = theme;
        }

        // Update toggle button icon
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', theme === 'light' ? 'sun' : 'moon');
                // Re-initialize Lucide icons
                if (window.lucide) {
                    lucide.createIcons();
                }
            }
        }
    }
};

// Global Theme object for backward compatibility
const Theme = {
    toggle: () => ThemeManager.cycleTheme(),
    setTheme: (theme) => ThemeManager.setTheme(theme),
    getCurrentTheme: () => ThemeManager.currentTheme
};

// Initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
        // Ensure admin panel gets proper theme on page load
        setTimeout(() => {
            if (typeof Admin !== 'undefined' && Admin.applyThemeToAdminPanel) {
                Admin.applyThemeToAdminPanel();
            }
        }, 500);
    });
} else {
    ThemeManager.init();
    // Ensure admin panel gets proper theme on page load
    setTimeout(() => {
        if (typeof Admin !== 'undefined' && Admin.applyThemeToAdminPanel) {
            Admin.applyThemeToAdminPanel();
        }
    }, 500);
}