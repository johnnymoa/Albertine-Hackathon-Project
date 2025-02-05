console.log("Content script loaded");

// Create and inject styles for the info button and chat modal
const style = document.createElement('style');
style.textContent = `
  .accessibility-info-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background-color: #3498db;
    color: white;
    border: none;
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, sans-serif;
    transition: all 0.3s ease;
  }

  .accessibility-info-button:hover {
    transform: scale(1.1);
    background-color: #2980b9;
    box-shadow: 0 6px 12px rgba(0,0,0,0.3);
  }

  .chat-modal {
    display: none;
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 350px;
    height: 500px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    z-index: 999998;
    overflow: hidden;
    font-family: Arial, sans-serif;
  }

  .chat-modal.active {
    display: flex;
    flex-direction: column;
  }

  .chat-header {
    padding: 15px;
    background: #3498db;
    color: white;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .close-chat {
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
  }

  #chat-container {
    flex-grow: 1;
    padding: 15px;
    overflow-y: auto;
    background: #f8f9fa;
  }

  .message {
    margin-bottom: 10px;
    padding: 10px;
    border-radius: 5px;
    max-width: 80%;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .user-message {
    background-color: #e3f2fd;
    margin-left: 20%;
  }

  .assistant-message {
    background-color: #ffffff;
    margin-right: 20%;
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  }

  #input-container {
    padding: 15px;
    background: white;
    border-top: 1px solid #eee;
    display: flex;
    gap: 10px;
  }

  #user-input {
    flex-grow: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  #send-button {
    padding: 8px 15px;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  #send-button:hover {
    background-color: #2980b9;
  }

  .accessibility-highlight {
    background-color: #ffeb3b !important;
    outline: 3px solid #ffc107 !important;
    transition: all 0.3s ease;
  }

  @media (max-width: 768px) {
    .accessibility-info-button {
      width: 60px;
      height: 60px;
      font-size: 28px;
    }

    .chat-modal {
      width: 90%;
      height: 80%;
      bottom: 100px;
      right: 5%;
    }
  }
`;

document.head.appendChild(style);

// Create the chat modal HTML
function createChatModal() {
    const modal = document.createElement('div');
    modal.className = 'chat-modal';
    modal.innerHTML = `
        <div class="chat-header">
            <span>Assistant d'accessibilité</span>
            <button class="close-chat">×</button>
        </div>
        <div id="chat-container"></div>
        <div id="input-container">
            <input type="text" id="user-input" placeholder="Tapez votre message...">
            <button id="send-button">Envoyer</button>
        </div>
    `;
    return modal;
}

// Create the info button
function createInfoButton() {
    console.log("Creating info button");
    const button = document.createElement('button');
    button.className = 'accessibility-info-button';
    button.innerHTML = 'i';
    button.setAttribute('aria-label', 'Information sur l\'accessibilité');
    button.title = 'Information sur l\'accessibilité';
    
    // Add click handler to show chat modal
    button.addEventListener('click', () => {
        const existingModal = document.querySelector('.chat-modal');
        if (existingModal) {
            existingModal.classList.add('active');
        } else {
            const modal = createChatModal();
            document.body.appendChild(modal);
            modal.classList.add('active');
            
            // Add event listeners for chat functionality
            setupChatEventListeners(modal);
        }
    });
    
    return button;
}

// Function to tag elements with unique accessibility IDs
function tagAccessibilityElements() {
    const elementTypes = {
        header: 'h1, h2, h3, h4, h5, h6',
        link: 'a',
        paragraph: 'p',
        button: 'button',
        input: 'input, textarea, select',
        landmark: '[role="navigation"], [role="main"], [role="search"]'
    };

    Object.entries(elementTypes).forEach(([type, selector]) => {
        Array.from(document.querySelectorAll(selector)).forEach((el, index) => {
            if (!el.getAttribute('data-accessibility-id')) {
                el.setAttribute('data-accessibility-id', `${type}-${index}`);
            }
        });
    });
}

// Function to clear existing highlights
function clearHighlights() {
    document.querySelectorAll('.accessibility-highlight').forEach(el => {
        el.classList.remove('accessibility-highlight');
    });
}

// Function to highlight and scroll to an element by ID
function highlightElementById(id) {
    const element = document.querySelector(`[data-accessibility-id="${id}"]`);
    if (element) {
        element.classList.add('accessibility-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Function to observe DOM changes
function observeDOMChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                tagAccessibilityElements();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Update getPageContext function to include accessibility IDs
function getPageContext() {
    const pageInfo = {
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        path: window.location.pathname
    };
    
    const links = Array.from(document.querySelectorAll('a'))
        .filter(link => link.textContent.trim() !== '')
        .map(link => ({ 
            id: link.getAttribute('data-accessibility-id'),
            text: link.textContent.trim(), 
            href: link.href,
            element: link
        }));
    
    const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .filter(header => header.textContent.trim() !== '')
        .map(header => ({ 
            id: header.getAttribute('data-accessibility-id'),
            tag: header.tagName, 
            text: header.textContent.trim(),
            element: header
        }));
    
    const paragraphs = Array.from(document.querySelectorAll('p'))
        .filter(p => p.textContent.trim() !== '')
        .map(p => ({ 
            id: p.getAttribute('data-accessibility-id'),
            text: p.textContent.trim(),
            element: p
        }));
    
    return { pageInfo, links, headers, paragraphs };
}

// Setup chat event listeners
function setupChatEventListeners(modal) {
    const closeButton = modal.querySelector('.close-chat');
    const input = modal.querySelector('#user-input');
    const sendButton = modal.querySelector('#send-button');
    const chatContainer = modal.querySelector('#chat-container');
    let messages = [];
    
    // Get initial page context
    const pageContext = getPageContext();

    const systemMessage = {
        role: 'system',
        content: `You are an accessibility assistant helping users navigate this webpage. Respond ONLY with JSON containing a "response" and "highlights".
    
    Current Page Information:
    - URL: ${pageContext.pageInfo.url}
    - Title: ${pageContext.pageInfo.title}
    - Domain: ${pageContext.pageInfo.domain}
    - Path: ${pageContext.pageInfo.path}
    
    Page Context:
    
    Links:
    ${pageContext.links.map(link => `- ID: ${link.id}, Text: "${link.text}" (${link.href})`).join('\n')}
    
    Headers:
    ${pageContext.headers.map(header => `- ID: ${header.id}, ${header.tag}: "${header.text}"`).join('\n')}
    
    Paragraphs:
    ${pageContext.paragraphs.map(p => `- ID: ${p.id}, Text: "${p.text}"`).join('\n')}
    
    Response Format:
    {
        "response": "Chat message responding to the user's question, the response should be in the same language as the user's question",
        "highlights": ["header-0", "link-3"] // Array of data-accessibility-ids to highlight
    }
    
    Rules:
    1. ALWAYS respond with valid JSON only
    2. Reference elements ONLY by their data-accessibility-id in highlights array
    3. Never mention the IDs in the response text
    4. Only include relevant IDs in highlights array
    5. Keep response natural and conversational
    6. Never include markdown formatting`
    };
  
    // Initialize messages with system message
    messages.push(systemMessage);

    closeButton.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    function addMessage(content, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.textContent = content;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Don't display system messages in the chat UI
        if (role !== 'system') {
            messages.push({ role, content });
        }
    }

    async function sendMessage() {
        const content = input.value.trim();
        if (!content) return;

        addMessage(content, 'user');
        input.value = '';

        try {
            const response = await fetch('http://localhost:5001/api/chat-json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: messages,
                    stream: false
                })
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            // Clear previous highlights
            clearHighlights();
            
            // Process new highlights
            if (data.highlights && Array.isArray(data.highlights)) {
                data.highlights.forEach(highlightElementById);
            }

            // Add assistant message
            addMessage(data.response, 'assistant');

        } catch (error) {
            console.error('Error:', error);
            addMessage('Désolé, une erreur est survenue. Veuillez réessayer.', 'assistant');
        }
    }

    sendButton.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Add welcome message
    addMessage('Bonjour! Je suis votre assistant d\'accessibilité. Je peux vous aider à trouver des informations sur cette page. Que recherchez-vous?', 'assistant');
}

// Function to show or hide the button
function toggleInfoButton(show) {
    console.log("Toggle info button called with show:", show);
    let button = document.querySelector('.accessibility-info-button');
    
    if (show && !button) {
        console.log("Attempting to create and append button");
        button = createInfoButton();
        document.body.appendChild(button);
        console.log("Button appended to body");
    } else if (!show && button) {
        console.log("Removing button");
        button.remove();
        // Also remove the modal if it exists
        const modal = document.querySelector('.chat-modal');
        if (modal) {
            modal.remove();
        }
    }
}

// Make sure document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeButton);
} else {
    initializeButton();
}

function initializeButton() {
    console.log("Initializing button");
    // Tag elements with accessibility IDs
    tagAccessibilityElements();
    
    // Set up DOM observer
    observeDOMChanges();
    
    // Check storage for initial state
    chrome.storage.sync.get(['accessEnabled'], (result) => {
        console.log("Storage state retrieved:", result);
        const isEnabled = result.accessEnabled !== undefined ? result.accessEnabled : true;
        console.log("Button should be enabled:", isEnabled);
        toggleInfoButton(isEnabled);
    });
}

// Listen for changes to the toggle state
chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log("Storage changed:", changes);
    if (namespace === 'sync' && changes.accessEnabled) {
        toggleInfoButton(changes.accessEnabled.newValue);
    }
});