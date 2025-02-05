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

let mediaRecorder;
let audioChunks = [];
let recordingStream = null;

function startRecording() {
    audioChunks = [];
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            recordingStream = stream;
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            mediaRecorder.onstop = () => {
                if (audioChunks.length > 0) {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audioElement = document.getElementById('audioPlayback');
                    audioElement.src = audioUrl;

                    // Stop all tracks to free up the microphone
                    stream.getTracks().forEach(track => track.stop());
                }
            };
            
            mediaRecorder.start();
            console.log("enregistrement started");
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
        });
}

function stopRecording() {
    const audioElement = document.getElementById('audioPlayback')
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        fetch(
            "http://localhost:5001/api/stt",
            {
                method : "POST",
                body: audioElement.src,
            }
        )
        console.log("enregistrement stopped");
    }
}


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
            <button id="record-button">Parler</button>
            <audio id="audioPlayback" hidden></audio>
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

// Function to get page context
function getPageContext() {
    // Get current page info
    const pageInfo = {
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        path: window.location.pathname
    };
    
    const links = Array.from(document.querySelectorAll('a'))
        .filter(link => link.textContent.trim() !== '')
        .map(link => ({ 
            text: link.textContent.trim(), 
            href: link.href,
            element: link
        }));
    
    const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .filter(header => header.textContent.trim() !== '')
        .map(header => ({ 
            tag: header.tagName, 
            text: header.textContent.trim(),
            element: header
        }));
    
    const paragraphs = Array.from(document.querySelectorAll('p'))
        .filter(p => p.textContent.trim() !== '')
        .map(p => ({ 
            text: p.textContent.trim(),
            element: p
        }));
    
    return { pageInfo, links, headers, paragraphs };
}

// Function to highlight an element
function highlightElement(element) {
    // Remove any existing highlights
    const highlighted = document.querySelectorAll('.accessibility-highlight');
    highlighted.forEach(el => el.classList.remove('accessibility-highlight'));
    
    // Add highlight to new element
    if (element) {
        element.classList.add('accessibility-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Setup chat event listeners
function setupChatEventListeners(modal) {
    const closeButton = modal.querySelector('.close-chat');
    const input = modal.querySelector('#user-input');
    const sendButton = modal.querySelector('#send-button');
    const recordButton = modal.querySelector('#record-button');
    const chatContainer = modal.querySelector('#chat-container');
    let messages = [];
    
    // Get initial page context
    const pageContext = getPageContext();

    // Create system message with page context
    recordButton.addEventListener('mousedown', startRecording);
    recordButton.addEventListener('mouseup', stopRecording);
    recordButton.addEventListener('mouseleave', stopRecording);

    const systemMessage = {
        role: 'system',
        content: `You are an accessibility assistant helping users navigate this webpage.

Current Page Information:
- URL: ${pageContext.pageInfo.url}
- Title: ${pageContext.pageInfo.title}
- Domain: ${pageContext.pageInfo.domain}
- Path: ${pageContext.pageInfo.path}

Here is the current page context:

Links found on the page:
${pageContext.links.map(link => `- "${link.text}" (${link.href})`).join('\n')}

Headers found on the page:
${pageContext.headers.map(header => `- ${header.tag}: "${header.text}"`).join('\n')}

Paragraphs found on the page:
${pageContext.paragraphs.map(p => `- "${p.text}"`).join('\n')}

When users ask about specific content, you can highlight elements on the page by including a "highlight" object in your response with the following structure three backticks then "json" then the object then three backticks:
\`\`\`json 
{
    "type": "link" | "header" | "paragraph",
    "text": "exact text to match"
}
\`\`\`

Help users find information by understanding their questions and highlighting relevant content on the page. You can reference the current URL or page title when explaining where they are on the website.`
    };

    // Initialize messages with system message
    messages.push(systemMessage);

    closeButton.addEventListener('click', () => {
        modal.classList.remove('active');
        // Remove any highlights when closing chat
        const highlighted = document.querySelectorAll('.accessibility-highlight');
        highlighted.forEach(el => el.classList.remove('accessibility-highlight'));
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
            const response = await fetch('http://localhost:5001/api/chat', {
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

            // Add assistant message
            addMessage(data.content, 'assistant');

            // If the response includes an element to highlight
            if (data.highlight) {
                let elementToHighlight = null;
                
                // Search in our page context for the matching element
                if (data.highlight.type === 'link') {
                    elementToHighlight = pageContext.links.find(l => 
                        l.text === data.highlight.text || l.href === data.highlight.href
                    )?.element;
                } else if (data.highlight.type === 'header') {
                    elementToHighlight = pageContext.headers.find(h => 
                        h.text === data.highlight.text
                    )?.element;
                } else if (data.highlight.type === 'paragraph') {
                    elementToHighlight = pageContext.paragraphs.find(p => 
                        p.text === data.highlight.text
                    )?.element;
                }

                if (elementToHighlight) {
                    highlightElement(elementToHighlight);
                }
            }

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