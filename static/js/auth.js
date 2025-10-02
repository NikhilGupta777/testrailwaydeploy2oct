// Authentication Module
const Auth = {
    getToken() { return localStorage.getItem(CONFIG.TOKEN_KEY); },
    setToken(token) { localStorage.setItem(CONFIG.TOKEN_KEY, token); },
    getCurrentUser() { return AppState.userData; },
    isAdmin() { return AppState.userData?.role === 'admin'; },

    clearAuth() {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem('userData');
        AppState.clearUserData();
        const appEl = document.getElementById('app');
        const loginModalEl = document.getElementById('app-login-modal');
        if (appEl) appEl.classList.add('hidden');
        if (loginModalEl) loginModalEl.classList.remove('hidden');
        if (typeof Campaign !== 'undefined' && Campaign.goToStep) {
            Campaign.goToStep(1);
        }
    },



    async handleManualLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        const loginButton = document.getElementById('login-button');

        if (!username || !password) {
            errorEl.textContent = 'Please enter username and password.';
            errorEl.style.color = 'red';
            return;
        }

        // Show loading state
        loginButton.disabled = true;
        loginButton.textContent = 'Signing in...';
        errorEl.textContent = '';

        try {
            console.log('Attempting login for username:', username);

            const response = await fetch(`${CONFIG.BACKEND_URL}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: username,
                    password: password
                })
            });

            console.log('Login response status:', response.status);

            if (!response.ok) {
                let errorMessage = 'Login failed';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorMessage;
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    errorMessage = `Login failed (${response.status})`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('Login successful, received token');

            if (!data.access_token) {
                throw new Error('No access token received');
            }

            Auth.setToken(data.access_token);
            await Auth.loadUserDataAndInitApp();

        } catch (error) {
            console.error('Login error:', error);
            errorEl.textContent = error.message;
            errorEl.style.color = 'red';
        } finally {
            // Reset button state
            loginButton.disabled = false;
            loginButton.textContent = 'Sign In';
        }
    },

    handleGoogleLogin() {
        window.location.href = `${CONFIG.BACKEND_URL}/auth/google`;
    },

    switchLoginTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.login-form').forEach(form => form.classList.add('hidden'));

        if (tab === 'manual') {
            document.getElementById('login-tab-manual').classList.add('active');
            document.getElementById('manual-login-form').classList.remove('hidden');
        } else {
            document.getElementById('login-tab-google').classList.add('active');
            document.getElementById('google-login-form').classList.remove('hidden');
        }
    },

    async loadUserData() {
        try {
            console.log('Loading user data...');
            AppState.userData = await API.fetch('/users/me');
            console.log('User data loaded:', AppState.userData);

            // Profile display will be updated by Profile module when initialized

            if (AppState.userData.role === 'admin') {
                AppState.SENDER_ACCOUNTS = [...AppState.SENDER_ACCOUNTS]; // Already initialized in config
            } else {
                AppState.SENDER_ACCOUNTS = [{ id: 1, email: AppState.userData.email, name: `${AppState.userData.username} Personal`, type: 'personal' }];
            }
            console.log('Sender accounts configured:', AppState.SENDER_ACCOUNTS);
        } catch (error) {
            console.error('Failed to load user data:', error);
            Auth.clearAuth();
            throw error;
        }
    },

    async loadUserDataAndInitApp() {
        try {
            console.log('Initializing app...');
            await Auth.loadUserData();

            console.log('Hiding login modal and showing app...');
            const loginModalEl = document.getElementById('app-login-modal');
            const appEl = document.getElementById('app');
            if (loginModalEl) loginModalEl.classList.add('hidden');
            if (appEl) {
                appEl.classList.remove('hidden');
                appEl.classList.add('flex');
            }

            // Profile and logout buttons moved to top right panel
            if (AppState.userData.role === 'admin') {
                console.log('User is admin, showing admin panel');
                document.getElementById('nav-admin').classList.remove('hidden');
                // Admin panel will be loaded when accessed via navigation
                console.log('Admin user logged in - admin panel available via navigation');
            }

            console.log('Initializing profile module...');
            if (typeof Profile !== 'undefined' && Profile.init) {
                // Wait a bit for DOM to be fully ready
                setTimeout(() => {
                    Profile.init();

                    // Profile display will be updated by Profile module

                    // Double-check if profile button is working
                    setTimeout(() => {
                        const profileBtn = document.getElementById('profile-dropdown-toggle');
                        if (profileBtn && !Profile.dropdownEventListenersAdded) {
                            console.warn('Profile button found but events not bound, forcing reinit...');
                            Profile.forceInit();
                        }
                    }, 500);
                }, 100);
            } else {
                console.error('Profile module not available or missing init method');
            }

            console.log('Initializing app modules...');
            await App.initialize();

            // Profile module will handle its own initialization

            console.log('App initialization complete!');

            // Final profile button test
            setTimeout(() => {
                const profileBtn = document.getElementById('profile-dropdown-toggle');
                if (profileBtn) {
                    console.log('✅ Profile button is available');
                    // Add a visual indicator that it's working
                    profileBtn.title = 'Profile (Click to open)';
                } else {
                    console.error('❌ Profile button still not found after complete initialization!');
                }
            }, 1500);

            // Chat disabled - admin panel loaded dynamically for admin users
        } catch (error) {
            console.error('Failed to initialize app:', error);
            Auth.clearAuth();
        }
    }
};