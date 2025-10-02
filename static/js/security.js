// Security utilities for XSS prevention and input sanitization
const Security = {
    // HTML escape function to prevent XSS
    escapeHtml(text) {
        if (typeof text !== 'string') {
            return text;
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Sanitize HTML content - improved security
    sanitizeHtml(html) {
        if (typeof html !== 'string') {
            return html;
        }
        
        // Use DOMParser for safer parsing
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Remove script tags and event handlers
        const scripts = doc.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Comprehensive list of dangerous attributes
        const dangerousAttrs = [
            'onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 
            'onchange', 'onsubmit', 'onkeydown', 'onkeyup', 'onkeypress',
            'onanimationstart', 'onanimationend', 'ontransitionend',
            'onpointerover', 'onpointerenter', 'onpointerdown', 'onpointermove',
            'onpointerup', 'onpointercancel', 'onpointerout', 'onpointerleave'
        ];
        
        const allElements = doc.querySelectorAll('*');
        allElements.forEach(element => {
            dangerousAttrs.forEach(attr => {
                if (element.hasAttribute(attr)) {
                    element.removeAttribute(attr);
                }
            });
            
            // Check href for javascript: protocol
            if (element.hasAttribute('href')) {
                const href = element.getAttribute('href');
                if (href && href.toLowerCase().startsWith('javascript:')) {
                    element.removeAttribute('href');
                }
            }
        });
        
        return doc.body ? doc.body.innerHTML : '';
    },

    // Safe innerHTML setter
    safeSetInnerHTML(element, content) {
        if (!element) return;
        element.innerHTML = this.sanitizeHtml(content);
    },

    // Safe textContent setter (preferred for text-only content)
    safeSetTextContent(element, content) {
        if (!element) return;
        element.textContent = content;
    },

    // Validate email format
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Validate URL format
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    // Create safe DOM element with text content
    createSafeElement(tagName, textContent, className = '') {
        const element = document.createElement(tagName);
        if (textContent) {
            element.textContent = textContent;
        }
        if (className) {
            element.className = className;
        }
        return element;
    },

    // Safe event handler attachment
    safeAddEventListener(element, event, handler) {
        if (!element || typeof handler !== 'function') return;
        element.addEventListener(event, handler);
    },

    // Input validation and sanitization
    sanitizeInput(input, type = 'text') {
        if (typeof input !== 'string') {
            return '';
        }

        switch (type) {
            case 'email':
                return input.trim().toLowerCase();
            case 'username':
                return input.trim().replace(/[^a-zA-Z0-9_-]/g, '');
            case 'number':
                return input.replace(/[^0-9.+-eE]/g, '');
            case 'alphanumeric':
                return input.replace(/[^a-zA-Z0-9]/g, '');
            default:
                return input.trim();
        }
    },

    // Rate limiting helper
    createRateLimiter(maxCalls, timeWindow) {
        const calls = [];
        return function() {
            const now = Date.now();
            // Remove old calls outside the time window
            while (calls.length > 0 && calls[0] < now - timeWindow) {
                calls.shift();
            }
            
            if (calls.length >= maxCalls) {
                return false; // Rate limit exceeded
            }
            
            calls.push(now);
            return true; // Call allowed
        };
    },

    // CSRF token management (if needed)
    getCSRFToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
    },

    // Safe JSON parsing
    safeJSONParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Invalid JSON string:', error);
            return defaultValue;
        }
    },

    // Content Security Policy helper
    isScriptAllowed(scriptContent) {
        // Basic check for dangerous script content
        const dangerousPatterns = [
            /eval\s*\(/,
            /Function\s*\(/,
            /setTimeout\s*\(\s*['"`]/,
            /setInterval\s*\(\s*['"`]/,
            /document\.write/,
            /innerHTML\s*=/,
            /outerHTML\s*=/
        ];
        
        return !dangerousPatterns.some(pattern => pattern.test(scriptContent));
    }
};

// Make Security available globally
window.Security = Security;