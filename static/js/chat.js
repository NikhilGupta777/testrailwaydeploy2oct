// Chat Module
const Chat = {
    currentRoom: null, // Will be set based on user permissions
    pollInterval: null,
    lastMessageId: 0,
    isInitialized: false,
    unreadCount: 0,
    isPanelOpen: false,

    init() {
        console.log('Chat: init() called');
        this.bindEvents();
        this.setLoadingState(true);
        this.loadUsers();
    },

    setLoadingState(loading) {
        const input = document.getElementById('chat-input');
        const sendButton = document.getElementById('chat-send');

        if (input) input.disabled = loading;
        if (sendButton) sendButton.disabled = loading;

        if (loading) {
            if (input) input.placeholder = 'Loading chat...';
        } else {
            if (input) input.placeholder = 'Type a message...';
        }
    },

    bindEvents() {
        console.log('Chat: Binding events');
        // Chat toggle button
        const chatToggle = document.getElementById('chat-toggle');
        if (chatToggle) {
            console.log('Chat: Found chat-toggle button, adding event listener');
            chatToggle.addEventListener('click', (e) => {
                console.log('Chat: Button clicked!');
                e.preventDefault();
                e.stopPropagation();
                console.log('Chat: Calling togglePanel()');
                this.togglePanel();
            });
        } else {
            console.error('Chat: chat-toggle button not found!');
        }

        // Chat close button
        const chatClose = document.getElementById('chat-close');
        if (chatClose) {
            chatClose.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Chat close clicked');
                this.hidePanel();
            });
        }

        // Room selection removed - we only use global chat

        // Send message
        const sendButton = document.getElementById('chat-send');
        if (sendButton) {
            sendButton.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // Enter key to send
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    },

    togglePanel() {
        console.log('Chat: togglePanel called');
        const panel = document.getElementById('chat-panel');
        if (panel) {
            console.log('Chat: Found chat-panel element');
            if (panel.classList.contains('hidden')) {
                console.log('Chat: Panel is hidden, calling showPanel');
                this.showPanel();
            } else {
                console.log('Chat: Panel is visible, calling hidePanel');
                this.hidePanel();
            }
        } else {
            console.error('Chat: chat-panel element not found!');
        }
    },

    showPanel() {
        console.log('Chat: showPanel called');
        const panel = document.getElementById('chat-panel');
        if (panel) {
            console.log('Chat: Found chat-panel, making it visible');

            // Remove the hidden class and force visibility with !important styles
            panel.classList.remove('hidden');
            panel.style.setProperty('display', 'flex', 'important');
            panel.style.setProperty('position', 'fixed', 'important');
            panel.style.setProperty('bottom', '1rem', 'important');
            panel.style.setProperty('right', '1rem', 'important');
            panel.style.setProperty('z-index', '9999', 'important');
            panel.style.setProperty('visibility', 'visible', 'important');

            this.isPanelOpen = true;
            console.log('Chat: Panel should now be visible');

            // Reset unread count when opening panel
            this.unreadCount = 0;
            this.updateUnreadBadge();

            // Only load messages and start polling if initialized
            if (this.isInitialized) {
                console.log('Chat: Loading messages and starting polling');
                this.loadMessages();
                this.startPolling();
                // Focus on input
                setTimeout(() => {
                    const input = document.getElementById('chat-input');
                    if (input && !input.disabled) {
                        input.focus();
                    }
                }, 100);
            } else {
                console.log('Chat: Not initialized, loading users');
                // If not initialized, try to initialize again
                this.loadUsers();
            }
        } else {
            console.error('Chat: chat-panel element not found in showPanel!');
        }
    },

    hidePanel() {
        const panel = document.getElementById('chat-panel');
        if (panel) {
            panel.classList.add('hidden');
            panel.style.setProperty('display', 'none', 'important');
            panel.style.setProperty('visibility', 'hidden', 'important');
            this.isPanelOpen = false;
            this.stopPolling();
        }
    },

    updateUnreadBadge() {
        const badge = document.getElementById('chat-unread-badge');
        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    // switchRoom removed - we only use global chat now

    async loadUsers() {
        // Wait for userData to be available
        if (!userData) {
            console.warn('User data not available, retrying in 500ms...');
            setTimeout(() => this.loadUsers(), 500);
            return;
        }

        try {
            // No need to load users for global chat, but keep for API compatibility
            await API.getChatUsers();

            // Set to global chat for all users
            this.currentRoom = 'global';

            // Update UI for global chat
            const buttonText = document.getElementById('chat-button-text');
            const panelTitle = document.getElementById('chat-panel-title');
            if (buttonText) buttonText.textContent = 'Team Chat';
            if (panelTitle) panelTitle.textContent = 'Team Chat';

            // Hide room select since we only have global chat
            const select = document.getElementById('chat-room-select');
            if (select) select.style.display = 'none';

            // Mark as initialized and remove loading state
            this.isInitialized = true;
            this.setLoadingState(false);

        } catch (error) {
            console.error('Failed to initialize chat:', error);
            this.setLoadingState(false);
        }
    },

    async loadMessages() {
        try {
            console.log('Chat: Loading messages for room:', this.currentRoom);
            const response = await API.getChatMessages(this.currentRoom);
            console.log('Chat: Loaded', response.messages.length, 'messages');
            this.displayMessages(response.messages);
            this.updateLastMessageId(response.messages);
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    },

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;

        // Check if chat is properly initialized
        if (!this.currentRoom) {
            alert('Chat is still loading. Please wait a moment and try again.');
            return;
        }

        console.log('Chat: Sending message to room:', this.currentRoom);
        const sendButton = document.getElementById('chat-send');
        sendButton.disabled = true;

        try {
            // Always send to global chat (no recipientId)
            const newMessage = await API.sendChatMessage(message, null, this.currentRoom);
            console.log('Chat: Message sent successfully:', newMessage);
            input.value = '';

            // Add message to UI immediately
            this.addMessageToUI(newMessage);
            this.updateLastMessageId([newMessage]);
        } catch (error) {
            console.error('Failed to send message:', error);
            alert('Failed to send message: ' + (error.message || 'Unknown error'));
            // Re-enable send button on error
            sendButton.disabled = false;
        } finally {
            sendButton.disabled = false;
        }
    },

    displayMessages(messages) {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';

        messages.forEach(message => {
            this.addMessageToUI(message);
        });

        // Scroll to bottom
        this.scrollToBottom();
    },

    addMessageToUI(message) {
        console.log('Chat: Adding message to UI:', message);
        const container = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');

        const isOwnMessage = message.sender_id === userData.id;
        const isAdminMessage = message.sender_role === 'admin';
        const timeString = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        console.log('Chat: isOwnMessage:', isOwnMessage, 'isAdminMessage:', isAdminMessage, 'sender_role:', message.sender_role);

        messageDiv.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;
        messageDiv.innerHTML = `
            <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${isOwnMessage
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            } ${isAdminMessage ? 'border-2 border-yellow-500 shadow-lg' : ''}">
                ${!isOwnMessage ? `<div class="text-xs font-semibold mb-1 ${isAdminMessage ? 'text-yellow-600 dark:text-yellow-400' : ''}">${message.sender_username}${isAdminMessage ? ' (Admin)' : ''}</div>` : ''}
                <div class="text-sm">${this.escapeHtml(message.message)}</div>
                <div class="text-xs opacity-70 mt-1">${timeString}</div>
            </div>
        `;

        container.appendChild(messageDiv);
        this.scrollToBottom();
    },

    updateLastMessageId(messages) {
        if (messages.length > 0) {
            this.lastMessageId = Math.max(this.lastMessageId, ...messages.map(m => m.id));
        }
    },

    startPolling() {
        this.stopPolling(); // Clear any existing polling
        this.pollInterval = setInterval(() => {
            this.pollForNewMessages();
        }, 3000); // Poll every 3 seconds
    },

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    },

    async pollForNewMessages() {
        // Don't poll if not initialized or no current room
        if (!this.isInitialized || !this.currentRoom) {
            return;
        }

        try {
            // Get recent messages to check for new ones
            const response = await API.getChatMessages(this.currentRoom, 50, 0);
            const allMessages = response.messages.reverse(); // Reverse to chronological order
            const newMessages = allMessages.filter(msg => msg.id > this.lastMessageId);

            console.log('Chat: Polling - lastMessageId:', this.lastMessageId, 'total messages:', allMessages.length, 'new messages:', newMessages.length);

            if (newMessages.length > 0) {
                console.log('Chat: Found', newMessages.length, 'new messages');

                // If panel is closed, increment unread count
                if (!this.isPanelOpen) {
                    this.unreadCount += newMessages.length;
                    this.updateUnreadBadge();
                }

                // Add messages to UI if panel is open
                if (this.isPanelOpen) {
                    newMessages.forEach(message => {
                        this.addMessageToUI(message);
                    });
                }

                this.updateLastMessageId(newMessages);
            }
        } catch (error) {
            console.error('Failed to poll for new messages:', error);
        }
    },

    scrollToBottom() {
        const container = document.getElementById('chat-messages');
        container.scrollTop = container.scrollHeight;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Reinitialize chat when user data changes (e.g., after login)
    reinitialize() {
        this.currentRoom = 'global'; // Always global
        this.lastMessageId = 0;
        this.isInitialized = false;
        this.unreadCount = 0;
        this.isPanelOpen = false;
        this.updateUnreadBadge();
        this.stopPolling();
        this.init();
    }
};