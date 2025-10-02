// Campaign Management Module
const Campaign = {
    async populateSenderAccounts() {
        const select = document.getElementById('sender-account');
        if (!select) {
            console.error('Sender account select element not found');
            return;
        }

        try {
            // Get user's available emails
            const userEmails = await API.getMyEmails();
            select.innerHTML = '';

            if (!userEmails || userEmails.length === 0) {
                select.innerHTML = '<option disabled>No email addresses available</option>';
                Campaign.showNotification('No email addresses available. Please add an email address first.', 'error');
                return;
            }

            userEmails.forEach((emailObj, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${emailObj.email} ${emailObj.is_primary ? '(Primary)' : ''}`;
                select.appendChild(option);
            });

            // Update AppState with actual user emails
            AppState.SENDER_ACCOUNTS = userEmails.map((emailObj, index) => ({
                id: index,
                name: emailObj.is_primary ? 'Primary Email' : 'Additional Email',
                email: emailObj.email
            }));

            console.log(`Loaded ${userEmails.length} email addresses for campaign sender`);
        } catch (error) {
            console.error('Failed to load user emails:', error);
            select.innerHTML = '<option disabled>Failed to load emails</option>';
            Campaign.showNotification('Failed to load email addresses. Please try again.', 'error');
        }
    },

    handleStep1Next() {
        const senderSelect = document.getElementById('sender-account');
        if (!senderSelect) return;
        const senderId = senderSelect.value;
        const selectedSender = AppState.SENDER_ACCOUNTS.find(s => s.id == senderId);
        if (!selectedSender) {
            this.showNotification('Please select a sender.', 'error');
            return;
        }
        AppState.currentState.sender = selectedSender;

        // Load templates for step 2
        Campaign.loadTemplatesForStep2();
        Campaign.goToStep(2);
    },

    async loadTemplatesForStep2() {
        const container = document.getElementById('template-options');
        if (!container) return;

        container.innerHTML = '<div class="text-center p-8"><div class="lds-dual-ring mx-auto mb-4"></div><p>Loading templates...</p></div>';

        try {
            const templates = await API.getTemplates();
            Campaign.populateTemplates(templates);
        } catch (error) {
            console.error('Failed to load templates:', error);
            container.innerHTML = '<div class="text-center text-red-500 p-8">Failed to load templates. Please try again.</div>';
            Campaign.showNotification('Failed to load templates. Please refresh the page.', 'error');
        }
    },

    populateTemplates(templates) {
        const container = document.getElementById('template-options');
        container.innerHTML = '';

        if (!templates || templates.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 p-8">No templates available. Create some templates first.</div>';
            return;
        }

        templates.forEach(tmpl => {
            // Skip templates that have neither SendGrid ID nor body content
            if (!tmpl.sendgrid_template_id && (!tmpl.body || tmpl.body.trim() === '')) {
                console.warn(`Skipping template "${tmpl.name}" - no content available`);
                return;
            }

            const card = document.createElement('div');
            card.className = 'p-4 border rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-500 transition';
            card.dataset.templateId = tmpl.id;

            const escapeHtml = (text) => {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            };

            const contentDiv = document.createElement('div');
            contentDiv.className = 'flex items-center';

            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', tmpl.sendgrid_template_id ? 'mail' : 'file-text');
            icon.className = 'w-8 h-8 text-blue-600 mr-4';

            const textDiv = document.createElement('div');

            const title = document.createElement('h4');
            title.className = 'font-bold text-gray-800';
            title.textContent = tmpl.name;

            const category = document.createElement('p');
            category.className = 'text-sm text-gray-500';
            category.textContent = tmpl.category;

            // Add template type indicator
            const typeIndicator = document.createElement('span');
            typeIndicator.className = tmpl.sendgrid_template_id ?
                'inline-block ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded' :
                'inline-block ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded';
            typeIndicator.textContent = tmpl.sendgrid_template_id ? 'SendGrid' : 'Custom';
            category.appendChild(typeIndicator);

            textDiv.appendChild(title);
            textDiv.appendChild(category);
            contentDiv.appendChild(icon);
            contentDiv.appendChild(textDiv);
            card.appendChild(contentDiv);
            card.addEventListener('click', () => Campaign.selectTemplate(tmpl));
            container.appendChild(card);
        });

        if (container.children.length === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 p-8">No valid templates found. Templates must have either SendGrid template ID or body content.</div>';
        }

        lucide.createIcons();
    },

    selectTemplate(templateObject) {
        AppState.currentState.template = templateObject;
        document.querySelectorAll('#template-options > div').forEach(div => {
            div.classList.remove('bg-blue-100', 'border-blue-500');
            if (div.dataset.templateId === templateObject.id) div.classList.add('bg-blue-100', 'border-blue-500');
        });
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        document.getElementById('preview-subject').textContent = `Subject: ${AppState.currentState.template.subject}`;
        if (AppState.currentState.template.sendgrid_template_id) {
            document.getElementById('preview-body').textContent = `SendGrid Template ID: ${AppState.currentState.template.sendgrid_template_id}\n\nThis template uses SendGrid's dynamic template system. Variables will be filled automatically during sending.`;
        } else {
            document.getElementById('preview-body').textContent = AppState.currentState.template.body || 'No body content available';
        }
        document.getElementById('template-preview-container').classList.remove('hidden');
        document.getElementById('step2-next').disabled = false;
    },

    handleRecipientInput() {
        const lines = document.getElementById('recipient-input').value.trim().split('\n').filter(line => line);
        AppState.currentState.recipients = lines.map(line => {
            const parts = line.split(',');
            return {
                email: parts[0]?.trim() || '',
                name: parts[1]?.trim() || 'Valued Contact',
                organization: parts[2]?.trim() || 'Your Organization'
            };
        }).filter(r => r.email && r.email.includes('@'));
        document.getElementById('recipient-count').textContent = AppState.currentState.recipients.length;
        document.getElementById('step3-next').disabled = AppState.currentState.recipients.length === 0;
    },

    goToStep(stepNumber) {
        AppState.currentState.currentStep = stepNumber;
        document.querySelectorAll('.step-card').forEach(card => card.classList.add('hidden'));
        const currentStepCard = document.getElementById(`step-${stepNumber}`);
        if (currentStepCard) currentStepCard.classList.remove('hidden');
        if (stepNumber === 4) Campaign.prepareReview();
    },

    prepareReview() {
        document.getElementById('review-sender').textContent = AppState.currentState.sender.email;
        document.getElementById('review-template').textContent = AppState.currentState.template.name;
        document.getElementById('review-recipient-count').textContent = AppState.currentState.recipients.length;
        const samplesContainer = document.getElementById('review-samples');
        samplesContainer.innerHTML = '';
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        AppState.currentState.recipients.slice(0, 3).forEach(recipient => {
            const sampleDiv = document.createElement('div');
            sampleDiv.className = 'p-3 border-t first:border-t-0';

            const toP = document.createElement('p');
            toP.className = 'text-sm text-gray-500';
            toP.textContent = `To: ${recipient.email}`;

            const subjectP = document.createElement('p');
            subjectP.className = 'font-bold text-gray-800';

            const hr = document.createElement('hr');
            hr.className = 'my-1';

            const bodyP = document.createElement('p');
            bodyP.className = 'text-gray-600 text-sm whitespace-pre-wrap';

            if (AppState.currentState.template.sendgrid_template_id) {
                // For SendGrid templates, show template info
                subjectP.textContent = Campaign.fillTemplate(AppState.currentState.template.subject, recipient);
                bodyP.textContent = `SendGrid Template: ${AppState.currentState.template.sendgrid_template_id}\n\nDynamic Data:\n- Name: ${recipient.name}\n- Email: ${recipient.email}\n- Organization: ${recipient.organization}`;
            } else {
                // For custom templates, show filled content
                subjectP.textContent = Campaign.fillTemplate(AppState.currentState.template.subject, recipient);
                const filledBody = Campaign.fillTemplate(AppState.currentState.template.body, recipient);
                bodyP.textContent = filledBody;
            }

            sampleDiv.appendChild(toP);
            sampleDiv.appendChild(subjectP);
            sampleDiv.appendChild(hr);
            sampleDiv.appendChild(bodyP);
            samplesContainer.appendChild(sampleDiv);
        });
        Campaign.checkPreflight();
    },

    checkPreflight() {
        const allChecked = [...document.querySelectorAll('.preflight-check')].every(c => c.checked);
        document.getElementById('send-button').disabled = !allChecked;
    },

    fillTemplate(templateString, recipient) {
        return templateString
            .replace(/\{\{name\}\}/g, recipient.name)
            .replace(/\{\{organization\}\}/g, recipient.organization)
            .replace(/\{\{email\}\}/g, recipient.email);
    },

    async startExecution() {
        try {
            Campaign.goToStep(5);
            const sendButton = document.getElementById('send-button');
            sendButton.disabled = true;
            sendButton.innerHTML = `<div class="lds-dual-ring"></div><span>Sending...</span>`;
            const logContainer = document.getElementById('sending-log');
            logContainer.innerHTML = '';
            let sentCount = 0, failCount = 0;
            const totalRecipients = AppState.currentState.recipients.length;

            const logMessage = (message, color = 'text-gray-400') => {
                logContainer.innerHTML += `<p><span class="text-gray-500">${new Date().toLocaleTimeString()}:</span> <span class="${color}">${message}</span></p>`;
                logContainer.scrollTop = logContainer.scrollHeight;
            };

            // Validate campaign setup before starting
            if (!AppState.currentState.sender || !AppState.currentState.sender.email) {
                logMessage('ERROR: No sender email configured.', 'text-red-400');
                Campaign.showNotification('No sender email configured', 'error');
                return;
            }

            if (!AppState.currentState.template) {
                logMessage('ERROR: No template selected.', 'text-red-400');
                Campaign.showNotification('No template selected', 'error');
                return;
            }

            if (!AppState.currentState.template.sendgrid_template_id && (!AppState.currentState.template.body || AppState.currentState.template.body.trim() === '')) {
                logMessage(`ERROR: Template "${AppState.currentState.template.name}" has no content.`, 'text-red-400');
                Campaign.showNotification('Selected template has no content', 'error');
                return;
            }

            logMessage(`Starting campaign from ${AppState.currentState.sender.email} using template "${AppState.currentState.template.name}"...`);
            logMessage(`Template type: ${AppState.currentState.template.sendgrid_template_id ? 'SendGrid' : 'Custom HTML'}`);

            for (let i = 0; i < totalRecipients; i++) {
                const recipient = AppState.currentState.recipients[i];
                document.getElementById('progress-text').textContent = `Sending ${i + 1} of ${totalRecipients}...`;

                try {
                    // Validate recipient data
                    if (!recipient.email || !recipient.email.includes('@')) {
                        logMessage(`SKIPPED: Invalid email "${recipient.email}".`, 'text-yellow-400');
                        failCount++;
                        continue;
                    }

                    if (AppState.currentState.template.sendgrid_template_id) {
                        // For SendGrid templates, send recipient data as dynamic template data
                        const dynamicData = {
                            name: recipient.name || 'Valued Contact',
                            email: recipient.email,
                            organization: recipient.organization || 'Your Organization'
                        };

                        logMessage(`Sending SendGrid template to ${recipient.email}...`, 'text-blue-400');

                        // Send email using standard API with template data
                        await API.sendEmail(
                            AppState.currentState.sender.email,
                            recipient.email,
                            AppState.currentState.template.subject,
                            `SendGrid Template: ${AppState.currentState.template.sendgrid_template_id}\n\nDynamic Data: ${JSON.stringify(dynamicData)}`
                        );
                    } else {
                        // For custom HTML templates, fill on frontend
                        const subject = Campaign.fillTemplate(AppState.currentState.template.subject, recipient);
                        const templateBody = AppState.currentState.template.body;

                        if (!templateBody || templateBody.trim() === '') {
                            logMessage(`FAILED: Template "${AppState.currentState.template.name}" has no body content.`, 'text-red-400');
                            failCount++;
                            continue;
                        }

                        const body = Campaign.fillTemplate(templateBody, recipient);

                        logMessage(`Sending custom template to ${recipient.email}...`, 'text-blue-400');

                        // Send email using standard API
                        await API.sendEmail(
                            AppState.currentState.sender.email,
                            recipient.email,
                            subject,
                            body
                        );
                    }

                    logMessage(`SUCCESS: Sent to ${recipient.email}.`, 'text-green-400');
                    sentCount++;
                } catch (error) {
                    const errorMsg = error.message || 'Unknown error';
                    logMessage(`FAILED: ${recipient.email}. (Reason: ${errorMsg})`, 'text-red-400');
                    console.error(`Campaign send error for ${recipient.email}:`, error);
                    failCount++;
                }

                document.getElementById('progress-bar').style.width = `${((i + 1) / totalRecipients) * 100}%`;

                // Add small delay to prevent overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            logMessage(`Campaign finished! Sent: ${sentCount}, Failed: ${failCount}`, sentCount > 0 ? 'text-green-400' : 'text-red-400');
            document.getElementById('campaign-complete').classList.remove('hidden');
            document.getElementById('final-sent-count').textContent = sentCount;
            document.getElementById('final-fail-count').textContent = failCount;

            // Show completion notification
            if (sentCount > 0) {
                Campaign.showNotification(`Campaign completed! ${sentCount} emails sent successfully.`, 'success');
            } else {
                Campaign.showNotification('Campaign completed but no emails were sent.', 'error');
            }

        } catch (error) {
            console.error('Campaign execution error:', error);
            Campaign.showNotification(`Campaign failed: ${error.message}`, 'error');

            // Reset UI on critical error
            const sendButton = document.getElementById('send-button');
            sendButton.disabled = false;
            sendButton.innerHTML = 'Send Campaign';
        }
    },

    reset() {
        Object.assign(AppState.currentState, { currentStep: 1, sender: null, template: null, recipients: [] });
        document.getElementById('recipient-input').value = '';
        Campaign.handleRecipientInput();
        document.querySelectorAll('.preflight-check').forEach(c => c.checked = false);
        Campaign.goToStep(1);
    },

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-red-100 border-red-400 text-red-700' :
            type === 'success' ? 'bg-green-100 border-green-400 text-green-700' :
                'bg-blue-100 border-blue-400 text-blue-700';
        notification.className = `fixed top-4 right-4 p-4 border rounded-lg ${bgColor} z-50`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
    }
};