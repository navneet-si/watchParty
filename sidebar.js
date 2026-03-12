function sideBar() {
    const ytApp = document.querySelector('ytd-app') || document.body;
    // 1. If it already exists, just open it and stop.
    if (document.getElementById('side_bar')) {
        document.getElementById('sync-float-btn').click(); 
        return; 
    }

    // --- STATE VARIABLES ---
    let isSidebarOpen = true;
    let fadeTimeout;

    // 2. Squeeze YouTube (Initial Open State)
    ytApp.style.transition = "padding-right 0.3s ease";
    ytApp.style.paddingRight = "300px"; 
    ytApp.style.boxSizing = "border-box";

    // 3. Create the FLOATING Button
    const floatBtn = document.createElement('div');
    floatBtn.id = 'sync-float-btn';
    floatBtn.innerHTML = '◀'; 
    floatBtn.style.cssText = `
        position: fixed; top: 20px; right: 0; width: 30px; height: 40px;
        background: #0f0f0f; color: white; display: none; align-items: center;
        justify-content: center; cursor: pointer; border: 1px solid #333;
        border-right: none; border-radius: 8px 0 0 8px; z-index: 999999;
        transition: opacity 0.4s ease; opacity: 1;
    `;
    document.documentElement.appendChild(floatBtn);

    // 4. Create the SIDEBAR Container
    const sidebar = document.createElement('div');
    sidebar.id = 'side_bar';
    sidebar.style.cssText = `
        position: fixed; top: 0; right: 0; width: 300px; height: 100vh;
        background-color: #0f0f0f; color: white; z-index: 999999;
        box-sizing: border-box; padding: 15px; display: flex;
        flex-direction: column; font-family: Roboto, Arial, sans-serif;
        border-left: 1px solid #333; transition: right 0.3s ease; 
    `;

    // 5. Fill Sidebar Content (Notice the input box is NO LONGER here)
    sidebar.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
            <h2 style="margin: 0; font-size: 18px;">🎥 Sync Room</h2>
            <button id="sync-close-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; padding: 5px;">▶</button>
        </div>
        <div id="sync-chat" style="flex-grow: 1; overflow-y: auto; margin-bottom: 10px;">
            <p style="color: #aaa; font-size: 14px;">Welcome to the room!</p>
        </div>
    `;

    // 6. CREATE THE TWO BUTTONS SIDE-BY-SIDE
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = "display: flex; gap: 5px; margin-bottom: 10px;";

    // --- Button A: Copy Link ---
    const linkBtn = document.createElement('div');
    linkBtn.innerText = "🔗 Copy Link";
    linkBtn.style.cssText = `
        flex: 1; padding: 10px; background-color: #2196F3; color: white; 
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
        flex: 1; padding: 10px; background-color: #555; color: white; 
        text-align: center; border-radius: 4px; cursor: pointer; 
        font-size: 12px; font-weight: bold; user-select: none; transition: background 0.2s;
    `;
    idBtn.addEventListener('click', () => {
        const roomId = sidebar.dataset.roomId;
        if (roomId) {
            navigator.clipboard.writeText(roomId).then(() => {
                const originalText = idBtn.innerText;
                idBtn.innerText = "✅ ID Copied!";
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

    // Append buttons to their container, then to the sidebar
    buttonContainer.appendChild(linkBtn);
    buttonContainer.appendChild(idBtn);
    sidebar.appendChild(buttonContainer);

    // 7. RE-ADD THE INPUT BOX AT THE VERY BOTTOM
    const chatInputWrapper = document.createElement('div');
    chatInputWrapper.innerHTML = `<input type="text" id="sync-input" placeholder="Chat or commands..." style="width: 100%; box-sizing: border-box; padding: 10px; border-radius: 4px; border: none; background: #222; color: white;">`;
    sidebar.appendChild(chatInputWrapper);

    // Append completed sidebar to the page
    document.documentElement.appendChild(sidebar);

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
                // Ensure we send the ID if it exists
                chrome.runtime.sendMessage({ 
                    action: "C2", 
                    text: messageText, 
                    roomId: sidebar.dataset.roomId 
                });
                chatInput.value = '';
            }
        });
    }
    
    // NOTE: Make sure this listener is ideally outside the sideBar() function in content.js to avoid duplicates!
    chrome.runtime.onMessage.addListener((msg) => {
        if(msg.action == "receive_chat"){
            appendChatMessage("friend",msg.text,"blue");
        }
    });

    setupChatInput();

    // --- TOGGLE LOGIC ---
    function closeSidebar() {
        isSidebarOpen = false;
        sidebar.style.right = '-300px';     
        ytApp.style.paddingRight = '0px';   
        floatBtn.style.display = 'flex';    
        resetFadeTimer();                   
    }

    function openSidebar() {
        isSidebarOpen = true;
        sidebar.style.right = '0';          
        ytApp.style.paddingRight = '300px'; 
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