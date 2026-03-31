function sideBar() {
    // 1. UPDATED: Find Netflix's (.watch-video), Hotstar's, or YouTube's container
    const appContainer = document.querySelector('.watch-video') || document.querySelector('ytd-app') || document.querySelector('.player-container') || document.body;
    
    // If it already exists, just open it and stop.
    if (document.getElementById('side_bar')) {
        document.getElementById('sync-float-btn').click(); 
        return; 
    }

    // --- STATE VARIABLES ---
    let isSidebarOpen = true;
    let fadeTimeout;

    // 2. Squeeze the App Container (Initial Open State)
    appContainer.style.transition = "padding-right 0.3s ease";
    appContainer.style.paddingRight = "300px"; 
    appContainer.style.boxSizing = "border-box";

    // 3. UPDATED: Define where to inject (Crucial for Netflix/Hotstar fullscreen)
    const targetContainer = document.fullscreenElement || document.querySelector('.watch-video') || document.querySelector('.player-container') || document.documentElement;

    // 4. Create the FLOATING Button
    const floatBtn = document.createElement('div');
    floatBtn.id = 'sync-float-btn';
    floatBtn.innerHTML = '◀'; 
    floatBtn.style.cssText = `
        position: fixed !important; top: 20px !important; right: 0 !important; width: 30px; height: 40px;
        background: #0f0f0f; color: white; display: none; align-items: center;
        justify-content: center; cursor: pointer; border: 1px solid #333;
        border-right: none; border-radius: 8px 0 0 8px; z-index: 2147483647 !important;
        transition: opacity 0.4s ease; opacity: 1;
    `;
    targetContainer.appendChild(floatBtn); 

    // 5. Create the SIDEBAR Container
    const sidebar = document.createElement('div');
    sidebar.id = 'side_bar';
    sidebar.style.cssText = `
        position: fixed !important; top: 0 !important; right: 0 !important; width: 300px !important; height: 100vh !important;
        background-color: #0f0f0f; color: white; z-index: 2147483647 !important;
        box-sizing: border-box; padding: 15px; display: flex;
        flex-direction: column; font-family: Roboto, Arial, sans-serif;
        border-left: 1px solid #333; transition: right 0.3s ease; 
    `;

    // 6. Fill Sidebar Content
    sidebar.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin: 0; font-size: 18px;">🎥 Sync Room</h2>
            <button id="sync-close-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; padding: 5px;">▶</button>
        </div>

        <div id="video-grid" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; max-height: 250px; overflow-y: auto;">
        </div>

        <div id="sync-chat" style="flex-grow: 1; overflow-y: auto; margin-bottom: 10px;">
            <p style="color: #aaa; font-size: 14px;">Welcome to the room!</p>
        </div>
    `;

    // 7. UPDATED: Create the FOUR BUTTONS in a 2x2 Grid so they fit!
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;";

    // --- Button A: Copy Link ---
    const linkBtn = document.createElement('div');
    linkBtn.innerText = "🔗 Copy Link";
    linkBtn.style.cssText = `
        padding: 8px; background-color: #2196F3; color: white; 
        text-align: center; border-radius: 4px; cursor: pointer; 
        font-size: 12px; font-weight: bold; user-select: none; transition: background 0.2s;
    `;
    linkBtn.addEventListener('click', () => {
        const urlToShare = sidebar.dataset.inviteLink || window.location.href;
        navigator.clipboard.writeText(urlToShare).then(() => {
            const originalText = linkBtn.innerText;
            linkBtn.innerText = "✅ Copied!";
            linkBtn.style.backgroundColor = "#4CAF50"; 
            setTimeout(() => {
                linkBtn.innerText = originalText;
                linkBtn.style.backgroundColor = "#2196F3"; 
            }, 2000);
        });
    });

    // --- Button B: Copy ID ---
    const idBtn = document.createElement('div');
    idBtn.innerText = "🆔 Copy ID";
    idBtn.style.cssText = `
        padding: 8px; background-color: #555; color: white; 
        text-align: center; border-radius: 4px; cursor: pointer; 
        font-size: 12px; font-weight: bold; user-select: none; transition: background 0.2s;
    `;
    idBtn.addEventListener('click', () => {
        const roomId = sidebar.dataset.roomId;
        if (roomId) {
            navigator.clipboard.writeText(roomId).then(() => {
                const originalText = idBtn.innerText;
                idBtn.innerText = "✅ Copied!";
                idBtn.style.backgroundColor = "#4CAF50"; 
                setTimeout(() => {
                    idBtn.innerText = originalText;
                    idBtn.style.backgroundColor = "#555"; 
                }, 2000);
            });
        } else {
            alert("No Room ID found.");
        }
    });

    // --- Button C: Toggle Mic ---
    const micBtn = document.createElement('div');
    micBtn.innerText = "🎤 Mic: ON";
    micBtn.style.cssText = `
        padding: 8px; background-color: #4CAF50; color: white; 
        text-align: center; border-radius: 4px; cursor: pointer; 
        font-size: 12px; font-weight: bold; user-select: none; transition: background 0.2s;
    `;
    micBtn.addEventListener('click', () => {
        if (typeof toggleMic === "function") {
            const isMicOn = toggleMic();
            micBtn.innerText = isMicOn ? "🎤 Mic: ON" : "🔇 Mic: OFF";
            micBtn.style.backgroundColor = isMicOn ? "#4CAF50" : "#f44336";
        }
    });

    // --- Button D: Toggle Cam ---
    const camBtn = document.createElement('div');
    camBtn.innerText = "📷 Cam: ON";
    camBtn.style.cssText = `
        padding: 8px; background-color: #4CAF50; color: white; 
        text-align: center; border-radius: 4px; cursor: pointer; 
        font-size: 12px; font-weight: bold; user-select: none; transition: background 0.2s;
    `;
    camBtn.addEventListener('click', () => {
        if (typeof toggleCamera === "function") {
            const isCamOn = toggleCamera();
            camBtn.innerText = isCamOn ? "📷 Cam: ON" : "🚫 Cam: OFF";
            camBtn.style.backgroundColor = isCamOn ? "#4CAF50" : "#f44336";
        }
    });

    // Append all buttons to the 2x2 grid
    buttonContainer.appendChild(linkBtn);
    buttonContainer.appendChild(idBtn);
    buttonContainer.appendChild(micBtn);
    buttonContainer.appendChild(camBtn);
    sidebar.appendChild(buttonContainer);

    // 8. Add Chat Input at the very bottom
    const chatInputWrapper = document.createElement('div');
    chatInputWrapper.innerHTML = `<input type="text" id="sync-input" placeholder="Chat or commands..." style="width: 100%; box-sizing: border-box; padding: 10px; border-radius: 4px; border: none; background: #222; color: white;">`;
    sidebar.appendChild(chatInputWrapper);

    // Append completed sidebar to the target container 
    targetContainer.appendChild(sidebar);

    // --- CHAT LOGIC ---
    function appendChatMessage(sender, text, color = "white") {
        const chatWindow = document.getElementById('sync-chat');
        if (!chatWindow) return; 

        const msgElement = document.createElement('p');
        msgElement.style.cssText = `color: ${color}; font-size: 14px; margin: 5px 0; word-break: break-word;`;
        msgElement.innerHTML = `<strong>${sender}:</strong> ${text}`;
        
        chatWindow.appendChild(msgElement);
        chatWindow.scrollTop = chatWindow.scrollHeight; 
    }
    
    function setupChatInput() {
        const chatInput = document.getElementById('sync-input');
        if (!chatInput) return; 

        chatInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && chatInput.value.trim() !== '') {
                const messageText = chatInput.value.trim();
                appendChatMessage("You", messageText, "#4CAF50"); 
                chrome.runtime.sendMessage({ 
                    action: "C2", 
                    text: messageText, 
                    roomId: sidebar.dataset.roomId 
                });
                chatInput.value = '';
            }
        });
    }
    
    // Only add this listener once (if check at top ensures this)
    chrome.runtime.onMessage.addListener((msg) => {
        if(msg.action == "receive_chat"){
            appendChatMessage("Friend", msg.text, "#2196F3");
        }
    });

    setupChatInput();

    // --- TOGGLE LOGIC ---
    function closeSidebar() {
        isSidebarOpen = false;
        // Use proper JS setProperty for !important
        sidebar.style.setProperty('right', '-300px', 'important');    
        appContainer.style.paddingRight = '0px';   
        floatBtn.style.display = 'flex';    
        resetFadeTimer();                   
    }

    function openSidebar() {
        isSidebarOpen = true;
        sidebar.style.setProperty('right', '0px', 'important');          
        appContainer.style.paddingRight = '300px'; 
        floatBtn.style.display = 'none';    
        clearTimeout(fadeTimeout);          
    }

    document.getElementById('sync-close-btn').addEventListener('click', closeSidebar);
    floatBtn.addEventListener('click', openSidebar);

    // --- MOUSE IDLE LOGIC ---
    function resetFadeTimer() {
        if (isSidebarOpen) return; 
        floatBtn.style.opacity = '1'; 
        clearTimeout(fadeTimeout);
        fadeTimeout = setTimeout(() => {
            if (!isSidebarOpen) floatBtn.style.opacity = '0'; 
        }, 2500); 
    }

    document.addEventListener('mousemove', resetFadeTimer);
}