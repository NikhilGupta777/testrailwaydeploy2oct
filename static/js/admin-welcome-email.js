// Welcome Email Enhancement for Admin Panel
const AdminWelcomeEmail = {
    // Send welcome email after user creation
    async sendWelcomeEmail(username, email, role) {
        const subject = "🎉 Welcome to the Team!";
        const body = `Hello ${username},

Welcome to the team! 🎉

Your account has been successfully created with the following details:
• Username: ${username}
• Email: ${email}
• Role: ${role}

You can now log in to the Outreach Automator and start using all the features available to you.

If you have any questions or need assistance, feel free to reach out to the admin team.

Best regards,
The Admin Team`;

        try {
            await API.sendEmail('admin@kalkiavatar.org', email, subject, body);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};

// Enhance the existing createUser function
if (typeof Admin !== 'undefined') {
    const originalCreateUser = Admin.createUser;

    Admin.createUser = async function () {
        const username = document.getElementById('admin-new-user-username').value.trim();
        const email = document.getElementById('admin-new-user-email').value.trim();
        const password = document.getElementById('admin-new-user-password').value;
        const role = document.getElementById('admin-new-user-role').value;
        const sendWelcomeEmail = document.getElementById('admin-send-welcome-email').checked;
        const messageEl = document.getElementById('admin-user-message');
        const button = document.getElementById('admin-add-user-btn');

        // Validation
        if (!username || !email || !password) {
            this.showFieldError(messageEl, 'Please fill in all required fields');
            return;
        }

        if (username.length < 3) {
            this.showFieldError(messageEl, 'Username must be at least 3 characters');
            return;
        }

        if (password.length < 8) {
            this.showFieldError(messageEl, 'Password must be at least 8 characters');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showFieldError(messageEl, 'Please enter a valid email address');
            return;
        }

        // Show loading state
        button.disabled = true;
        button.innerHTML = '<i data-lucide="loader" class="w-4 h-4 mr-2 animate-spin"></i> Creating...';
        lucide.createIcons();

        try {
            // Create user
            await API.createUserAdmin({
                username,
                email,
                password,
                role,
                send_welcome_email: sendWelcomeEmail
            });

            // Send welcome email if requested
            if (sendWelcomeEmail) {
                button.innerHTML = '<i data-lucide="mail" class="w-4 h-4 mr-2 animate-spin"></i> Sending welcome email...';
                lucide.createIcons();

                const emailResult = await AdminWelcomeEmail.sendWelcomeEmail(username, email, role);

                if (emailResult.success) {
                    this.showFieldSuccess(messageEl, `User created and welcome email sent to ${email}! 🎉`);
                    this.showNotification(`User created and welcome email sent to ${email}!`);
                } else {
                    this.showFieldSuccess(messageEl, `User created successfully! (Welcome email failed: ${emailResult.error})`);
                    this.showNotification(`User created but welcome email failed: ${emailResult.error}`, 'warning');
                }
            } else {
                this.showFieldSuccess(messageEl, 'User created successfully!');
                this.showNotification('User created successfully!');
            }

            // Clear form
            document.getElementById('admin-new-user-username').value = '';
            document.getElementById('admin-new-user-email').value = '';
            document.getElementById('admin-new-user-password').value = '';
            document.getElementById('admin-send-welcome-email').checked = false;

            this.loadUsers();
        } catch (error) {
            this.showFieldError(messageEl, error.message || 'Failed to create user');
            this.showNotification(error.message || 'Failed to create user', 'error');
        } finally {
            // Reset button
            button.disabled = false;
            button.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4 mr-2"></i> Create User';
            lucide.createIcons();
        }
    };
}