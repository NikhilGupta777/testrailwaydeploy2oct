// Template Management Module
const Templates = {
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    isAdmin() {
        const user = Auth.getCurrentUser();
        return user && user.role === 'admin';
    },
    async load() {
        const grid = document.getElementById('templates-grid');
        grid.innerHTML = '<div class="col-span-full text-center p-8"><div class="lds-dual-ring mx-auto mb-4"></div><p>Loading templates...</p></div>';

        try {
            const templates = await API.getTemplates();
            grid.innerHTML = '';
            
            // Add "Create Template" button for admins only
            if (this.isAdmin()) {
                const createCard = document.createElement('div');
                createCard.className = 'p-4 rounded-lg shadow hover:shadow-lg transition border-2 border-dashed border-blue-300 cursor-pointer';
                createCard.innerHTML = `
                    <div class="text-center text-blue-500">
                        <div class="text-3xl mb-2">+</div>
                        <div class="font-bold">Create Template</div>
                        <div class="text-sm">Admin Only</div>
                    </div>
                `;
                createCard.onclick = () => this.showAdminCreateModal();
                grid.appendChild(createCard);
            }

            templates.forEach(template => {
                const card = this.createTemplateCard(template);
                grid.appendChild(card);
            });
        } catch (error) {
            grid.innerHTML = `<div class="text-red-500 p-4">Error loading templates: ${this.escapeHtml(error.message)}</div>`;
        }
    },

    createTemplateCard(template) {
        const card = document.createElement('div');
        card.className = 'p-4 rounded-lg shadow hover:shadow-lg transition';
        card.style.backgroundColor = 'var(--bg-primary)';
        
        // Template header
        const header = document.createElement('div');
        header.className = 'flex justify-between items-start mb-2';
        
        const title = document.createElement('h3');
        title.className = 'font-bold text-lg template-title';
        title.textContent = template.name;
        
        // SendGrid badge
        if (template.sendgrid_template_id) {
            const badge = document.createElement('span');
            badge.className = 'bg-green-100 text-green-800 text-xs px-2 py-1 rounded';
            badge.textContent = 'SendGrid';
            header.appendChild(badge);
        }
        
        header.appendChild(title);
        card.appendChild(header);
        
        // Template info
        const category = document.createElement('p');
        category.className = 'text-sm template-description';
        category.textContent = template.category;
        
        const subject = document.createElement('p');
        subject.className = 'mt-2 template-description';
        subject.textContent = template.subject;
        
        // Variables display
        if (template.template_variables && template.template_variables.length > 0) {
            const varsDiv = document.createElement('div');
            varsDiv.className = 'mt-2';
            varsDiv.innerHTML = `<small class="text-gray-600">Variables: ${template.template_variables.map(v => `{{${v}}}`).join(', ')}</small>`;
            card.appendChild(varsDiv);
        }
        
        // Preview
        const previewDiv = document.createElement('div');
        previewDiv.className = 'mt-3 p-2 border rounded template-preview';
        previewDiv.style.maxHeight = '150px';
        previewDiv.style.overflow = 'auto';

        if (template.preview_html) {
            previewDiv.innerHTML = template.preview_html;
            previewDiv.style.fontSize = '11px';
        } else if (template.body) {
            previewDiv.textContent = template.body.substring(0, 100) + (template.body.length > 100 ? '...' : '');
        } else {
            previewDiv.textContent = 'No preview available';
            previewDiv.style.fontStyle = 'italic';
            previewDiv.style.color = '#666';
        }
        
        // Admin buttons
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'mt-4 flex justify-between';
        
        if (this.isAdmin()) {
            const editBtn = document.createElement('button');
            editBtn.className = 'text-blue-500 hover:underline';
            editBtn.textContent = 'Edit';
            editBtn.onclick = () => this.showAdminEditModal(template);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'text-red-500 hover:underline';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => this.delete(template.id, template.name);
            
            buttonsDiv.appendChild(editBtn);
            buttonsDiv.appendChild(deleteBtn);
        } else {
            buttonsDiv.innerHTML = '<span class="text-gray-500 text-sm">Admin-managed template</span>';
        }
        
        card.appendChild(category);
        card.appendChild(subject);
        card.appendChild(previewDiv);
        card.appendChild(buttonsDiv);
        
        return card;
    },

    async showAdminCreateModal() {
        const modal = this.createAdminModal('Create Template');
        document.body.appendChild(modal);
    },

    async showAdminEditModal(template) {
        const modal = this.createAdminModal('Edit Template', template);
        document.body.appendChild(modal);
    },

    createAdminModal(title, template = null) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        const nameValue = template?.name ? this.escapeHtml(template.name) : '';
        const categoryValue = template?.category ? this.escapeHtml(template.category) : '';
        const subjectValue = template?.subject ? this.escapeHtml(template.subject) : '';
        const bodyValue = template?.body ? this.escapeHtml(template.body) : '';
        const templateIdValue = template?.sendgrid_template_id ? this.escapeHtml(template.sendgrid_template_id) : '';
        const variablesValue = template?.template_variables ? this.escapeHtml(template.template_variables.join(', ')) : '';
        const previewValue = template?.preview_html ? this.escapeHtml(template.preview_html) : '';
        
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 class="text-xl font-bold mb-4">${this.escapeHtml(title)}</h2>
                <form id="templateForm">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Template Name</label>
                            <input type="text" name="name" class="w-full p-2 border rounded" value="${nameValue}" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Category</label>
                            <input type="text" name="category" class="w-full p-2 border rounded" value="${categoryValue}" required>
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Subject</label>
                        <input type="text" name="subject" class="w-full p-2 border rounded" value="${subjectValue}" required>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Email Body</label>
                        <textarea name="body" class="w-full p-2 border rounded h-32" placeholder="Email body content with {{variable}} placeholders" required>${bodyValue}</textarea>
                        <small class="text-gray-600">Required for campaign emails. Use {{name}}, {{email}}, {{organization}} variables.</small>
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">SendGrid Template ID</label>
                        <input type="text" name="sendgrid_template_id" class="w-full p-2 border rounded" value="${templateIdValue}" placeholder="d-1234567890abcdef">
                        <small class="text-gray-600">Optional: Leave empty for custom HTML templates</small>
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Template Variables</label>
                        <input type="text" name="template_variables" class="w-full p-2 border rounded" value="${variablesValue}" placeholder="name, email, company">
                        <small class="text-gray-600">Comma-separated list of variables (without {{}})</small>
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Preview HTML</label>
                        <textarea name="preview_html" class="w-full p-2 border rounded h-32" placeholder="Static HTML preview for frontend display">${previewValue}</textarea>
                    </div>
                    
                    <div class="flex justify-end gap-2">
                        <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">${template ? 'Update' : 'Create'}</button>
                    </div>
                </form>
            </div>
        `;
        
        const form = modal.querySelector('#templateForm');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                subject: formData.get('subject'),
                body: formData.get('body'),
                category: formData.get('category'),
                sendgrid_template_id: formData.get('sendgrid_template_id') || null,
                preview_html: formData.get('preview_html') || null,
                template_variables: formData.get('template_variables') ?
                    formData.get('template_variables').split(',').map(v => v.trim()).filter(v => v) : null
            };
            
            try {
                if (template) {
                    await API.updateTemplateAdmin(template.id, data);
                } else {
                    await API.createTemplateAdmin(data);
                }
                modal.remove();
                this.load();
                this.showNotification(`Template ${template ? 'updated' : 'created'} successfully!`, 'success');
            } catch (error) {
                this.showNotification(`Failed to ${template ? 'update' : 'create'} template: ${error.message}`, 'error');
            }
        };
        
        return modal;
    },

    async showCreateModal() {
        if (!this.isAdmin()) {
            this.showNotification('Only administrators can create templates', 'error');
            return;
        }
        this.showAdminCreateModal();
    },

    async edit(templateId) {
        if (!this.isAdmin()) {
            this.showNotification('Only administrators can edit templates', 'error');
            return;
        }
        // Find template and show admin edit modal
        const templates = await API.getTemplates();
        const template = templates.find(t => t.id === templateId);
        if (template) {
            this.showAdminEditModal(template);
        }
    },

    async delete(templateId, name) {
        if (this.showConfirm(`Delete template "${name}"?`)) {
            try {
                await API.deleteTemplate(templateId);
                Templates.load();
            } catch (error) {
                this.showNotification(`Failed to delete template: ${error.message}`, 'error');
            }
        }
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
    },

    showConfirm(message) {
        return confirm(message); // Temporary - replace with modal in production
    },

    showPrompt(message) {
        return prompt(message); // Temporary - replace with modal in production
    }
};