/**
 * Anne's Fashion Line — Live Chatbot & Human Support Integration
 * Handles AI Shopping Assistance, Catalogue Grounding, Real-time Backend Sync,
 * and Handoff to Human Staff.
 */

class FashionBot {
    constructor() {
        this.container = null;
        this.messagesContainer = null;
        this.input = null;
        this.launcher = null;
        this.statusHeader = null;
        this.requestHumanBtn = null;
        this.isOpen = false;

        // Session & State Tracking
        this.sessionId = this.getOrCreateSessionId();
        this.conversationId = null;
        this.state = 'AI_ACTIVE'; // AI_ACTIVE | HUMAN_REQUESTED | HUMAN_ASSIGNED | HUMAN_ACTIVE | RESOLVED | CLOSED
        this.assignedStaffName = null;
        this.lastMessageId = 0;
        this.pollInterval = null;

        // Grounded Persona System Prompt
        this.systemPrompt = `
AI AGENT DIRECTIVES — ANNE'S FASHION LINE (NAIROBI EDITION)

ROLE: You are the friendly, stylish female fashion shopping assistant for Anne's Fashion Line in Nairobi.
AUDIENCE: Younger millennial women, older Gen Z women, mothers, women shopping for themselves looking for confidence and style.

TONE & PERSONALITY:
- Warm, feminine, conversational, encouraging, fashion-aware, natural, confident.
- Mix standard English with tasteful, natural Nairobi touch / light Sheng when appropriate (e.g. "Babe", "Sis", "Manze", "Form ni gani", "Mali safi").
- Keep responses short, warm, and helpful (1-3 sentences max).
- Use emojis occasionally and naturally (do not put an emoji in every sentence).
- Feel like one woman helping another woman choose clothing she genuinely likes.

CATALOGUE & PRODUCT ASSISTANCE:
- You are grounded in the actual website catalogue for Anne's Fashion Line.
- If asked for categories, share direct page links:
  - Casual Wear: <a href='casual.html'>Casual Collection</a>
  - Corporate / Office Wear: <a href='corporate.html'>Corporate Line</a>
  - Weekend / Party Outfits: <a href='weekend.html'>Weekend Collection</a>
  - Dresses: <a href='dresses.html'>Dresses Collection</a>
  - Wigs & Hair: <a href='wigs.html'>Wigs Collection</a>
  - Makeup & Beauty: <a href='makeup.html'>Makeup & Beauty</a>
  - Shoes & Heels: <a href='shoes.html'>Shoes Collection</a>

STRICT BUSINESS RULES:
- Never promise arbitrary discounts, free delivery, custom refunds, delivery times, or stock reservations on your own.
- If a customer asks for special discounts, refunds, or complex business approvals, explain that a team member can confirm it, and offer: "You can tap 'Request Human Agent' above to speak with our team!"
- Never body-shame or make negative assumptions about anyone's body. Be empowering, encouraging, and supportive.
        `;

        this.history = [];
        this.contextString = '';
    }

    getOrCreateSessionId() {
        let sid = localStorage.getItem('annes_chat_session_id');
        if (!sid) {
            sid = 'sess_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
            localStorage.setItem('annes_chat_session_id', sid);
        }
        return sid;
    }

    init() {
        if (this.container) return;

        // Inject UI (Launcher + Chat Window + Status Header + Human Request Action)
        const html = `
            <!-- Floating Launcher Button -->
            <button class="chatbot-launcher" id="chatLauncher" title="Chat with Anne's Assistant">
                <i class="fas fa-comment-dots"></i>
            </button>

            <!-- Chat Container -->
            <div class="chatbot-container" id="chatbot">
                <div class="chat-header">
                    <div class="chat-profile">
                        <img src="assets/instagram/photos/Makeup.jpg" alt="Anne's Assistant" class="chat-avatar">
                        <div class="chat-info">
                            <h3 id="chatHeaderTitle">Anne's Assistant</h3>
                            <span id="chatHeaderStatus"><span class="status-dot"></span> AI Active</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn-request-human" id="requestHumanHeaderBtn" title="Request Human Agent">
                            <i class="fas fa-headset"></i> Request Human
                        </button>
                        <button class="btn-close-chat" id="closeChat"><i class="fas fa-times"></i></button>
                    </div>
                </div>

                <div class="chat-status-bar" id="chatStatusBar" style="display: none;">
                    <span id="chatStatusText">Connecting...</span>
                    <button id="chatStatusAction" style="background:none; border:none; color:var(--chat-primary); text-decoration:underline; font-size:0.75rem; cursor:pointer; display:none;">Resume AI</button>
                </div>
                
                <div class="chat-messages" id="chatMessages">
                    <div class="message bot">
                        Hi babe! 👋 Welcome to Anne's Fashion Line! How can I help you style your look today?
                    </div>
                </div>

                <div class="chat-input-area">
                    <input type="text" class="chat-input" id="chatInput" placeholder="Type a message...">
                    <button class="btn-send-chat" id="sendChat"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        // UI Bindings
        this.container = document.getElementById('chatbot');
        this.messagesContainer = document.getElementById('chatMessages');
        this.input = document.getElementById('chatInput');
        this.launcher = document.getElementById('chatLauncher');
        this.requestHumanBtn = document.getElementById('requestHumanHeaderBtn');
        this.statusBar = document.getElementById('chatStatusBar');
        this.statusText = document.getElementById('chatStatusText');
        this.statusAction = document.getElementById('chatStatusAction');

        const closeBtn = document.getElementById('closeChat');
        const sendBtn = document.getElementById('sendChat');

        // Events
        closeBtn.addEventListener('click', () => this.close());
        this.launcher.addEventListener('click', () => this.open('user_click'));
        sendBtn.addEventListener('click', () => this.handleUserMessage());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleUserMessage();
        });

        this.requestHumanBtn.addEventListener('click', () => this.requestHumanAgent());
        this.statusAction.addEventListener('click', () => this.resumeAIAssistant());

        // Connect to Backend Session & Load History
        this.syncWithBackend();
    }

    async syncWithBackend(contextData = null) {
        try {
            const pageName = window.location.pathname.split('/').pop() || 'index.html';
            let productId = null;
            let productTitle = null;

            if (contextData) {
                productTitle = contextData.productName;
            } else {
                const params = new URLSearchParams(window.location.search);
                if (params.get('id')) productId = params.get('id');
                const titleEl = document.querySelector('.product-title-main');
                if (titleEl) productTitle = titleEl.textContent;
            }

            const response = await fetch('api/chat/start_or_get.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    customer_name: 'Guest Customer',
                    product_id: productId,
                    product_title: productTitle,
                    page: pageName
                })
            });

            const data = await response.json();

            if (data.success && data.data) {
                this.conversationId = data.data.conversation.id;
                this.state = data.data.conversation.status || 'AI_ACTIVE';
                this.assignedStaffName = data.data.conversation.assigned_staff_name;

                sessionStorage.setItem('annes_conv_id', this.conversationId);

                // Render Server Messages
                if (data.data.messages && data.data.messages.length > 0) {
                    this.messagesContainer.innerHTML = '';
                    this.history = [];

                    data.data.messages.forEach(msg => {
                        this.lastMessageId = Math.max(this.lastMessageId, parseInt(msg.id) || 0);

                        let senderClass = 'bot';
                        if (msg.sender_type === 'customer') senderClass = 'user';
                        else if (msg.sender_type === 'staff') senderClass = 'staff';
                        else if (msg.sender_type === 'system') senderClass = 'system';

                        this.renderMessage(msg.content, senderClass, msg.sender_name);

                        if (msg.sender_type === 'customer' || msg.sender_type === 'ai') {
                            this.history.push({
                                role: msg.sender_type === 'customer' ? 'user' : 'assistant',
                                content: msg.content
                            });
                        }
                    });
                }

                this.updateUIForState();

                // Start Polling if waiting for or active with Human
                if (['HUMAN_REQUESTED', 'HUMAN_ASSIGNED', 'HUMAN_ACTIVE'].includes(this.state)) {
                    this.startPolling();
                }
            }
        } catch (err) {
            console.warn('Backend sync failed, running in local mode:', err);
            this.loadLocalHistory();
        }
    }

    updateUIForState() {
        const headerStatus = document.getElementById('chatHeaderStatus');
        const headerTitle = document.getElementById('chatHeaderTitle');

        if (this.state === 'HUMAN_REQUESTED') {
            if (headerTitle) headerTitle.textContent = "Support Handoff";
            if (headerStatus) headerStatus.innerHTML = '<span class="status-dot" style="background:#e5c158;"></span> Waiting for Staff';
            this.statusBar.style.display = 'flex';
            this.statusText.textContent = "Request received. A team member will join shortly.";
            this.statusAction.style.display = 'inline';
            this.statusAction.textContent = "Cancel Request";
            this.requestHumanBtn.style.display = 'none';

        } else if (this.state === 'HUMAN_ACTIVE' || this.state === 'HUMAN_ASSIGNED') {
            const staffName = this.assignedStaffName || 'Staff Member';
            if (headerTitle) headerTitle.textContent = staffName;
            if (headerStatus) headerStatus.innerHTML = '<span class="status-dot" style="background:#2ecc71;"></span> Staff Active';
            this.statusBar.style.display = 'flex';
            this.statusText.textContent = `Connected with ${staffName}.`;
            this.statusAction.style.display = 'inline';
            this.statusAction.textContent = "Resume AI";
            this.requestHumanBtn.style.display = 'none';

        } else {
            // AI_ACTIVE or RESOLVED
            if (headerTitle) headerTitle.textContent = "Anne's Assistant";
            if (headerStatus) headerStatus.innerHTML = '<span class="status-dot" style="background:#2ecc71;"></span> Active now';
            this.statusBar.style.display = 'none';
            this.requestHumanBtn.style.display = 'flex';
            this.stopPolling();
        }
    }

    open(triggerReason = 'default', contextData = null) {
        if (!this.container) this.init();

        this.container.classList.add('active');
        this.launcher.classList.add('hidden');
        this.isOpen = true;
        sessionStorage.setItem('annes_bot_open', 'true');

        if (contextData) {
            this.contextString = `\n[CURRENT PRODUCT CONTEXT]\nProduct: ${contextData.productName}\nBody Type: ${contextData.activeBodyType}\nSkin Tone: ${contextData.activeTone}\nPreview generated for customer.`;
            sessionStorage.setItem('annes_bot_context', this.contextString);
        } else {
            this.contextString = sessionStorage.getItem('annes_bot_context') || '';
        }

        if (triggerReason === 'try_on_complete') {
            this.addTyping();
            setTimeout(() => {
                this.removeTyping();
                const initialMsg = "Hi babe! 😍 How are we feeling about this outfit preview? 🔥";
                this.addMessage(initialMsg, 'bot');
                this.addQuickReplies(['I love it! 😍', 'Not sure... 😕', 'Request Human Agent 💬']);
            }, 800);
        }
    }

    close() {
        if (this.container) {
            this.container.classList.remove('active');
            this.launcher.classList.remove('hidden');
            this.isOpen = false;
            sessionStorage.setItem('annes_bot_open', 'false');
        }
    }

    loadLocalHistory() {
        const savedHistory = sessionStorage.getItem('annes_bot_history');
        if (savedHistory) {
            this.history = JSON.parse(savedHistory);
            this.messagesContainer.innerHTML = '';
            this.history.forEach(msg => this.renderMessage(msg.content, msg.role === 'assistant' ? 'bot' : 'user'));
        }
        if (sessionStorage.getItem('annes_bot_open') === 'true') {
            this.open('restore');
        }
    }

    saveLocalHistory() {
        sessionStorage.setItem('annes_bot_history', JSON.stringify(this.history));
    }

    renderMessage(text, sender, senderName = null) {
        const oldReplies = this.messagesContainer.querySelector('.quick-replies');
        if (oldReplies) oldReplies.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;

        if (sender === 'staff' && senderName) {
            msgDiv.innerHTML = `<div class="message-sender-name">${senderName}</div>${text}`;
        } else {
            msgDiv.innerHTML = text;
        }

        this.messagesContainer.appendChild(msgDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    addMessage(text, sender, saveToBackend = true) {
        this.renderMessage(text, sender);

        if (saveToBackend && this.conversationId) {
            fetch('api/chat/send_message.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: this.conversationId,
                    sender_type: sender === 'bot' ? 'ai' : (sender === 'user' ? 'customer' : sender),
                    sender_name: sender === 'bot' ? "Anne's Assistant" : 'Customer',
                    content: text
                })
            }).then(res => res.json()).then(res => {
                if (res.success && res.data && res.data.id) {
                    this.lastMessageId = Math.max(this.lastMessageId, parseInt(res.data.id));
                }
            }).catch(e => console.warn('Message send background warning:', e));
        }
    }

    addQuickReplies(options) {
        const container = document.createElement('div');
        container.className = 'quick-replies';

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'quick-reply-btn';
            btn.textContent = opt;
            btn.onclick = () => {
                container.remove();
                if (opt.toLowerCase().includes('request human')) {
                    this.requestHumanAgent();
                } else {
                    this.addMessage(opt, 'user');
                    this.history.push({ role: 'user', content: opt });
                    this.saveLocalHistory();
                    this.generateResponse(opt);
                }
            };
            container.appendChild(btn);
        });

        this.messagesContainer.appendChild(container);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    handleUserMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        this.input.value = '';
        this.addMessage(text, 'user');
        this.history.push({ role: 'user', content: text });
        this.saveLocalHistory();

        // Check Intent for Requesting Human Agent
        const humanIntentPattern = /\b(human|agent|person|staff|customer support|talk to someone|speak to someone|real person|representative)\b/i;

        if (humanIntentPattern.test(text) && this.state === 'AI_ACTIVE') {
            this.addTyping();
            setTimeout(() => {
                this.removeTyping();
                const reply = "I can definitely connect you with a member of our team! Tapping below to notify our staff:";
                this.addMessage(reply, 'bot');
                this.history.push({ role: 'assistant', content: reply });
                this.saveLocalHistory();
                this.requestHumanAgent();
            }, 600);
            return;
        }

        // If currently handling via Human Agent, do NOT invoke AI auto-reply
        if (['HUMAN_REQUESTED', 'HUMAN_ASSIGNED', 'HUMAN_ACTIVE'].includes(this.state)) {
            // Message sent to backend, waiting for human staff
            return;
        }

        // Standard AI Response path
        this.generateResponse(text);
    }

    addTyping() {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator message bot';
        indicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        indicator.style.display = 'flex';
        indicator.id = 'typingIndicator';
        this.messagesContainer.appendChild(indicator);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    removeTyping() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    async generateResponse(userText) {
        this.addTyping();

        try {
            const recentHistory = this.history.slice(-6).map(msg => {
                return `${msg.role === 'user' ? 'Client' : 'Anne\'s Assistant'}: ${msg.content}`;
            }).join('\n');

            // Grounding: catalog context
            let catalogueContext = "";
            if (window.productsData && Array.isArray(window.productsData)) {
                const sampleProducts = window.productsData.slice(0, 8).map(p => `- ${p.title} (${p.category}): ${p.price}`).join('\n');
                catalogueContext = `\n[WEBSITE CATALOGUE EXCERPT]\n${sampleProducts}\n`;
            }

            const fullPrompt = `
${this.systemPrompt}

${catalogueContext}
${this.contextString || "[Client is browsing the catalogue.]"}

[CONVERSATION HISTORY]
${recentHistory}

[CURRENT MESSAGE]
Client: ${userText}
Anne's Assistant:
            `;

            let aiResponse = "";
            if (window.Putter && typeof window.Putter.chat === 'function') {
                aiResponse = await window.Putter.chat(fullPrompt, this.systemPrompt);
            } else {
                aiResponse = "Manze I'm right here to help you pick the best look! What vibe are you shopping for today? ✨";
            }

            this.removeTyping();
            this.addMessage(aiResponse, 'bot', true);
            this.history.push({ role: 'assistant', content: aiResponse });
            this.saveLocalHistory();

        } catch (error) {
            console.error("AI Generation Error:", error);
            this.removeTyping();
            const fallback = "I'm having a quick moment, but you can tap 'Request Human Agent' above to speak directly with our team! 💖";
            this.addMessage(fallback, 'bot');
        }
    }

    async requestHumanAgent() {
        if (!this.conversationId) {
            await this.syncWithBackend();
        }

        try {
            const res = await fetch('api/chat/request_human.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation_id: this.conversationId })
            });

            const data = await res.json();
            if (data.success) {
                this.state = 'HUMAN_REQUESTED';
                this.updateUIForState();
                this.renderMessage(data.data.message || "We've received your request. A member of our team will join the conversation shortly.", 'system');
                this.startPolling();
            }
        } catch (err) {
            console.error('Request human agent error:', err);
            this.renderMessage("We've logged your request. A team member will join shortly.", 'system');
            this.state = 'HUMAN_REQUESTED';
            this.updateUIForState();
        }
    }

    async resumeAIAssistant() {
        if (!this.conversationId) return;

        try {
            const res = await fetch('api/chat/staff_action.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: this.conversationId,
                    action: 'resume_ai'
                })
            });

            const data = await res.json();
            if (data.success) {
                this.state = 'AI_ACTIVE';
                this.updateUIForState();
                this.renderMessage("Anne's AI Assistant is back! How can I help you?", 'system');
            }
        } catch (err) {
            console.error('Resume AI error:', err);
            this.state = 'AI_ACTIVE';
            this.updateUIForState();
        }
    }

    startPolling() {
        this.stopPolling();
        this.pollInterval = setInterval(() => this.pollForUpdates(), 2500);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async pollForUpdates() {
        if (!this.conversationId) return;

        try {
            const res = await fetch(`api/chat/poll.php?conversation_id=${encodeURIComponent(this.conversationId)}&last_message_id=${this.lastMessageId}`);
            const data = await res.json();

            if (data.success && data.data) {
                const conv = data.data.conversation;
                const newMsgs = data.data.new_messages;

                // State check
                if (conv.status !== this.state || conv.assigned_staff_name !== this.assignedStaffName) {
                    this.state = conv.status;
                    this.assignedStaffName = conv.assigned_staff_name;
                    this.updateUIForState();
                }

                // Render New Incoming Messages
                if (newMsgs && newMsgs.length > 0) {
                    newMsgs.forEach(msg => {
                        this.lastMessageId = Math.max(this.lastMessageId, parseInt(msg.id));

                        let senderClass = 'bot';
                        if (msg.sender_type === 'customer') senderClass = 'user';
                        else if (msg.sender_type === 'staff') senderClass = 'staff';
                        else if (msg.sender_type === 'system') senderClass = 'system';

                        // Render message if it wasn't created locally
                        if (msg.sender_type !== 'customer') {
                            this.renderMessage(msg.content, senderClass, msg.sender_name);
                        }
                    });
                }
            }
        } catch (err) {
            console.warn('Poll warning:', err);
        }
    }
}

// Instantiate global fashion bot
window.fashionBot = new FashionBot();

document.addEventListener('DOMContentLoaded', () => {
    window.fashionBot.init();

    const hasSeenBot = localStorage.getItem('annes_bot_seen');
    if (!hasSeenBot) {
        setTimeout(() => {
            if (!window.fashionBot.isOpen) {
                window.fashionBot.open('first_visit');
                localStorage.setItem('annes_bot_seen', 'true');
            }
        }, 3000);
    }
});
