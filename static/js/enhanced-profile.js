// Enhanced Profile System with Modern UI/UX
const EnhancedProfile = {
    isDropdownOpen: false,
    currentTab: 'profile',

    init() {
        this.bindEvents();
        this.updateProfileDisplay();
        this.initializeAvatars();
    },

    bindEvents() {
        // Profile dropdown toggle
        const dropdownToggle = document.getElementById('profile-dropdown-toggle');
        if (dropdownToggle) {
            dropdownToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Listen for theme changes
        document.addEventListener('themeChanged', () => {
            this.updateAvatarColors();
        });

        // Enhanced dropdown logout
        const enhancedLogout = document.getElementById('enhanced-dropdown-logout');
        if (enhancedLogout) {
            enhancedLogout.addEventListener('click', () => {
                this.closeDropdown();
                Auth.clearAuth();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isDropdownOpen) {
                const dropdown = document.getElementById('enhanced-profile-dropdown');
                const toggle = document.getElementById('profile-dropdown-toggle');
                if (dropdown && !dropdown.contains(e.target) && !toggle.contains(e.target)) {
                    this.closeDropdown();
                }
            }
        });

        // Profile modal events
        const profileModal = document.getElementById('enhanced-profile-modal');
        if (profileModal) {
            // Tab switching
            profileModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('profile-tab')) {
                    this.switchTab(e.target.dataset.tab);
                }
            });

            // Form submissions
            const profileForm = document.getElementById('enhanced-profile-form');
            const passwordForm = document.getElementById('enhanced-password-form');
            const settingsForm = document.getElementById('enhanced-settings-form');

            if (profileForm) {
                profileForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveProfile();
                });
            }

            if (passwordForm) {
                passwordForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.changePassword();
                });
            }

            if (settingsForm) {
                settingsForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveSettings();
                });
            }
        }

        // Avatar upload
        const avatarInput = document.getElementById('avatar-upload');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => this.handleAvatarUpload(e));
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.isDropdownOpen) {
                    this.closeDropdown();
                } else {
                    this.close();
                }
            }
        });
    },

    toggleDropdown() {
        if (this.isDropdownOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    },

    openDropdown() {
        const dropdown = document.getElementById('enhanced-profile-dropdown');
        const chevron = document.getElementById('profile-chevron');

        if (!dropdown) return;

        this.updateProfileDisplay();
        dropdown.classList.remove('hidden');
        dropdown.classList.add('animate-fade-in');
        if (chevron) chevron.classList.add('rotate-180');
        this.isDropdownOpen = true;
    },

    closeDropdown() {
        const dropdown = document.getElementById('enhanced-profile-dropdown');
        const chevron = document.getElementById('profile-chevron');

        if (dropdown) {
            dropdown.classList.add('hidden');
            dropdown.classList.remove('animate-fade-in');
        }
        if (chevron) chevron.classList.remove('rotate-180');
        this.isDropdownOpen = false;
    },

    open() {
        const modal = document.getElementById('enhanced-profile-modal');
        if (!modal) return;

        // Load current user data
        this.loadUserData();
        this.loadSettings();
        this.switchTab('profile');

        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        // Focus first input
        setTimeout(() => {
            const firstInput = modal.querySelector('input:not([type="hidden"])');
            if (firstInput) firstInput.focus();
        }, 100);
    },

    close() {
        const modal = document.getElementById('enhanced-profile-modal');
        if (modal) {
            modal.classList.add('hidden');
            this.clearMessages();
            this.clearPasswordFields();
        }
    },

    switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.profile-tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        const activeContent = document.getElementById(`profile-${tabName}-tab`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }
    },

    loadUserData() {
        if (!AppState.userData) return;

        const { username, email } = AppState.userData;

        // Profile tab
        const usernameInput = document.getElementById('enhanced-profile-username');
        const emailInput = document.getElementById('enhanced-profile-email');

        if (usernameInput) usernameInput.value = username || '';
        if (emailInput) emailInput.value = email || '';

        // Update avatar
        this.updateAvatar(username);
    },

    updateProfileDisplay() {
        if (!AppState.userData) return;

        const { username, email } = AppState.userData;

        // Update dropdown display
        const dropdownUsername = document.getElementById('enhanced-dropdown-username');
        const dropdownEmail = document.getElementById('enhanced-dropdown-email');
        const profileDisplay = document.getElementById('profile-username-display');

        if (dropdownUsername) dropdownUsername.textContent = username || 'Unknown';
        if (dropdownEmail) dropdownEmail.textContent = email || 'No email';
        if (profileDisplay) profileDisplay.textContent = username || 'User';

        // Update avatar
        this.updateAvatar(username);
    },

    initializeAvatars() {
        if (AppState.userData) {
            this.updateAvatar(AppState.userData.username);
        }
    },

    updateAvatar(username) {
        const avatars = document.querySelectorAll('.user-avatar');
        const initials = this.getInitials(username);

        avatars.forEach(avatar => {
            // Check if user has custom avatar
            const customAvatar = localStorage.getItem(`avatar_${username}`);

            if (customAvatar) {
                avatar.innerHTML = `<img src="${customAvatar}" alt="Avatar" class="w-full h-full object-cover rounded-full">`;
            } else {
                // Use initials
                avatar.innerHTML = `<span class="text-sm font-semibold">${initials}</span>`;
                avatar.style.backgroundColor = this.getAvatarColor(username);
            }
        });
    },

    updateAvatarColors() {
        if (AppState.userData) {
            this.updateAvatar(AppState.userData.username);
        }
    },

    getInitials(username) {
        if (!username) return 'U';
        return username.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2);
    },

    getAvatarColor(username) {
        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
            '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
        ];
        const hash = username ? username.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
        return colors[hash % colors.length];
    },

    handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            this.showMessage('profile-message', 'Please select a valid image file', 'error');
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            this.showMessage('profile-message', 'Image size must be less than 2MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;

            // Store in localStorage (in real app, upload to server)
            localStorage.setItem(`avatar_${AppState.userData.username}`, imageData);

            // Update avatar display
            this.updateAvatar(AppState.userData.username);

            this.showMessage('profile-message', 'Avatar updated successfully!', 'success');
        };

        reader.readAsDataURL(file);
    },

    async saveProfile() {
        this.clearMessages();

        const usernameInput = document.getElementById('enhanced-profile-username');
        const emailInput = document.getElementById('enhanced-profile-email');

        if (!usernameInput || !emailInput) return;

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();

        // Validation
        if (!this.validateProfileForm(username, email)) return;

        const saveBtn = document.getElementById('enhanced-profile-save-btn');
        const originalText = saveBtn ? saveBtn.textContent : '';

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="animate-spin w-4 h-4 mr-2" data-lucide="loader-2"></i>Saving...';
            lucide.createIcons();
        }

        try {
            const updatedUser = await API.updateProfile({ username, email });
            AppState.userData = updatedUser;

            this.updateProfileDisplay();
            this.showMessage('profile-message', 'Profile updated successfully!', 'success');

            setTimeout(() => this.close(), 1500);
        } catch (error) {
            this.showMessage('profile-message', error.message || 'Failed to update profile', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
        }
    },

    async changePassword() {
        this.clearMessages();

        const currentPasswordInput = document.getElementById('enhanced-current-password');
        const newPasswordInput = document.getElementById('enhanced-new-password');
        const confirmPasswordInput = document.getElementById('enhanced-confirm-password');

        if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) return;

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Validation
        if (!this.validatePasswordForm(currentPassword, newPassword, confirmPassword)) return;

        const changeBtn = document.getElementById('enhanced-change-password-btn');
        const originalText = changeBtn ? changeBtn.textContent : '';

        if (changeBtn) {
            changeBtn.disabled = true;
            changeBtn.innerHTML = '<i class="animate-spin w-4 h-4 mr-2" data-lucide="loader-2"></i>Changing...';
            lucide.createIcons();
        }

        try {
            await API.changePassword({
                current_password: currentPassword,
                new_password: newPassword
            });

            this.showMessage('password-message', 'Password changed successfully!', 'success');
            this.clearPasswordFields();

            setTimeout(() => this.close(), 1500);
        } catch (error) {
            this.showMessage('password-message', error.message || 'Failed to change password', 'error');
        } finally {
            if (changeBtn) {
                changeBtn.disabled = false;
                changeBtn.textContent = originalText;
            }
        }
    },

    saveSettings() {
        // Save user preferences to localStorage
        const emailNotifications = document.getElementById('email-notifications').checked;
        const darkMode = document.getElementById('dark-mode-setting').checked;
        const compactView = document.getElementById('compact-view').checked;

        const settings = {
            emailNotifications,
            compactView
        };

        localStorage.setItem(`settings_${AppState.userData.username}`, JSON.stringify(settings));

        // Apply dark mode setting using ThemeManager
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = darkMode ? 'dark' : 'light';

        if (newTheme !== currentTheme) {
            if (typeof ThemeManager !== 'undefined') {
                ThemeManager.setTheme(newTheme);
            } else {
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
            }
            // Dispatch theme change event
            document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));
        }

        this.showMessage('settings-message', 'Settings saved successfully!', 'success');
    },

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem(`settings_${AppState.userData.username}`) || '{}');
        const currentTheme = localStorage.getItem('theme') || 'light';

        const emailNotifications = document.getElementById('email-notifications');
        const darkMode = document.getElementById('dark-mode-setting');
        const compactView = document.getElementById('compact-view');

        if (emailNotifications) emailNotifications.checked = settings.emailNotifications !== false;
        if (darkMode) darkMode.checked = currentTheme === 'dark';
        if (compactView) compactView.checked = settings.compactView === true;
    },

    validateProfileForm(username, email) {
        if (!username) {
            this.showMessage('profile-message', 'Username is required', 'error');
            return false;
        }

        if (username.length < 3) {
            this.showMessage('profile-message', 'Username must be at least 3 characters', 'error');
            return false;
        }

        if (!email) {
            this.showMessage('profile-message', 'Email is required', 'error');
            return false;
        }

        if (!this.isValidEmail(email)) {
            this.showMessage('profile-message', 'Please enter a valid email address', 'error');
            return false;
        }

        return true;
    },

    validatePasswordForm(currentPassword, newPassword, confirmPassword) {
        if (!currentPassword) {
            this.showMessage('password-message', 'Current password is required', 'error');
            return false;
        }

        if (!newPassword) {
            this.showMessage('password-message', 'New password is required', 'error');
            return false;
        }

        if (newPassword.length < 8) {
            this.showMessage('password-message', 'New password must be at least 8 characters', 'error');
            return false;
        }

        if (newPassword !== confirmPassword) {
            this.showMessage('password-message', 'Passwords do not match', 'error');
            return false;
        }

        if (currentPassword === newPassword) {
            this.showMessage('password-message', 'New password must be different from current password', 'error');
            return false;
        }

        return true;
    },

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    showMessage(elementId, message, type = 'error') {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.textContent = message;
        element.className = `text-sm mt-2 text-center transition-all duration-300 ${type === 'success' ? 'text-green-500' :
            type === 'warning' ? 'text-yellow-500' : 'text-red-500'
            }`;

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                element.textContent = '';
            }, 3000);
        }
    },

    clearMessages() {
        const messageElements = ['profile-message', 'password-message', 'settings-message'];
        messageElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '';
            }
        });
    },

    clearPasswordFields() {
        const passwordFields = [
            'enhanced-current-password',
            'enhanced-new-password',
            'enhanced-confirm-password'
        ];

        passwordFields.forEach(id => {
            const field = document.getElementById(id);
            if (field) field.value = '';
        });
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (typeof AppState !== 'undefined') {
        EnhancedProfile.init();
    } else {
        setTimeout(() => EnhancedProfile.init(), 100);
    }
});

// Global functions for backward compatibility
window.openEnhancedProfile = () => EnhancedProfile.open();
window.closeEnhancedProfile = () => EnhancedProfile.close();
window.openProfile = () => EnhancedProfile.open();
window.closeProfile = () => EnhancedProfile.close();