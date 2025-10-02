// Quick fix for email users functionality
document.addEventListener('DOMContentLoaded', function() {
    // Override the updateEmailPreview function
    if (typeof Admin !== 'undefined' && Admin.updateEmailPreview) {
        Admin.updateEmailPreview = function() {
            const subject = document.getElementById('email-subject')?.value || '';
            const content = document.getElementById('email-content')?.value || '';
            const recipientType = document.querySelector('input[name="recipient-type"]:checked')?.value;
            
            const allCheckboxes = document.querySelectorAll('.user-checkbox');
            const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
            
            let recipientCount = 0;
            if (recipientType === 'all') {
                recipientCount = allCheckboxes.length;
            } else {
                recipientCount = selectedCheckboxes.length;
            }
            
            // Update user count displays
            const allUsersCount = document.getElementById('all-users-count');
            const selectedUsersCount = document.getElementById('selected-users-count');
            
            if (allUsersCount) allUsersCount.textContent = `${allCheckboxes.length} users`;
            if (selectedUsersCount) selectedUsersCount.textContent = `${selectedCheckboxes.length} selected`;
            
            // Update preview
            const previewSubject = document.getElementById('preview-subject');
            const previewContent = document.getElementById('preview-content');
            
            if (previewSubject) previewSubject.textContent = subject || 'Enter subject above';
            if (previewContent) previewContent.textContent = content || 'Enter content above';
            
            // Update send button state
            const sendBtn = document.getElementById('send-email-btn');
            if (sendBtn) {
                const canSend = subject.trim() && content.trim() && recipientCount > 0;
                sendBtn.disabled = !canSend;
                if (canSend) {
                    sendBtn.className = 'px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-semibold';
                    sendBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4 mr-2"></i>Send Email';
                } else {
                    sendBtn.className = 'px-6 py-3 bg-gray-400 text-white rounded-lg cursor-not-allowed flex items-center font-semibold';
                    sendBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4 mr-2"></i>Send Email';
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        };
    }
});