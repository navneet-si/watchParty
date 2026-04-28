let currentPlatform = "youtube"; // Default fallback
if (window.location.hostname.includes("hotstar.com")) {
    currentPlatform = "hotstar";
} else if (window.location.hostname.includes("netflix.com")) {
    currentPlatform = "netflix";
}

let isRemoteUpdate = false; // <--- THE LOCK

function add() {
  const videos = document.getElementsByTagName('video');
  
  // Determine which video tag to grab based on platform
  let video;
  if (currentPlatform === "hotstar") {
      video = videos[videos.length - 1];
  } else if (currentPlatform === "netflix") {
      video = document.querySelector('video'); 
  } else {
      video = videos[0];
  }

  // Only add listener if video exists AND we haven't added it yet
  if (video && !video.dataset.listenerAttached) {
      video.dataset.listenerAttached = "true";
      console.log(`Video listener attached for ${currentPlatform}!`);

      // --- OUTGOING: User moves the bar --

      video.addEventListener('pause', () => {
          if(isRemoteUpdate){
            isRemoteUpdate = false;
            return;
          }
          chrome.runtime.sendMessage({ action: "pause" });
      });

      video.addEventListener('play', () => {
          if(isRemoteUpdate){
            isRemoteUpdate = false;
            return;
          }
          chrome.runtime.sendMessage({ action: "resume" });
      });

      video.addEventListener('seeked', () => {
        if (isRemoteUpdate) {
            isRemoteUpdate = false; 
            return; 
        }
        const time = video.currentTime;
        try {
          chrome.runtime.sendMessage({ action: "user-seeked", seekat: time });
        } catch (e) {
          console.error(e);
        }
      });
  }
}

// --- INCOMING: Server moves the bar ---
chrome.runtime.onMessage.addListener((msg) => {
    
    if (msg.action === "remote_seek") {
        const videos = document.getElementsByTagName('video');
        let video;
        if (currentPlatform === "hotstar") {
            video = videos[videos.length - 1];
        } else if (currentPlatform === "netflix") {
            video = document.querySelector('video');
        } else {
            video = videos[0];
        }
        
        if (video) {
            isRemoteUpdate = true; 
            video.currentTime = msg.time; 
        }
    }

    if (msg.action == "pause") {
      isRemoteUpdate = true;
      if (currentPlatform === "netflix") {
          const pauseBtn = document.querySelector('[data-uia="control-play-pause-pause"]');
          if (pauseBtn) pauseBtn.click();
          else { const v = document.querySelector('video'); if(v) v.pause(); }
      } else if (currentPlatform === "hotstar") {
          const pauseBtn = document.querySelector('button[aria-label="Pause"]');
          if (pauseBtn) pauseBtn.click();
          else { const vs = document.getElementsByTagName('video'); const v = vs[vs.length - 1]; if (v) v.pause(); }
      } else {
          const video = document.querySelector('video');
          if(video) video.pause();
      }
    }

    if (msg.action == "resume") {
      isRemoteUpdate = true;
      if (currentPlatform === "netflix") {
          const playBtn = document.querySelector('[data-uia="control-play-pause-play"]');
          if (playBtn) playBtn.click();
          else { const v = document.querySelector('video'); if(v) v.play(); }
      } else if (currentPlatform === "hotstar") {
          const playBtn = document.querySelector('button[aria-label="Play"]');
          if (playBtn) playBtn.click();
          else { const vs = document.getElementsByTagName('video'); const v = vs[vs.length - 1]; if (v) v.play(); }
      } else {
          const video = document.querySelector('video');
          if(video) video.play();
      }
    }

    if (msg.action == "add_sideBar") {
      if (typeof sideBar === "function"){
          sideBar();
          startLocalVideo();
      } 
      const id = document.getElementById('side_bar');
      if(id){
        id.dataset.roomId = msg.roomId;
        id.dataset.inviteLink = msg.inviteLink;
      }
    }
});

(function checkUrlForInvite() {
    chrome.storage.local.get(['storedRoom', 'inviteLink'], (result) => {
        const inviteId = result.storedRoom;
        const urlParams = result.inviteLink;

        if (inviteId) {
            console.log("Found Invite Code in memory! Auto-joining:", inviteId);

            // A. Open the UI immediately
            if (typeof sideBar === "function") sideBar(); 
            
            // Turn on the camera for the person joining via link!
            if (typeof startLocalVideo === "function") startLocalVideo();

            // B. Stamp the ID onto the sidebar so Chat/Sync works
            const sidebar = document.getElementById('side_bar');
            if (sidebar) {
                sidebar.dataset.roomId = inviteId;
                sidebar.dataset.inviteLink = urlParams; 
                
                const chat = document.getElementById('sync-chat');
                if(chat) {
                    chat.innerHTML += `<p style="color:#2196F3; font-size:12px;"><strong>System:</strong> Auto-joined Room via Link!</p>`;
                }
            }

            // ---> THE FIX: The Wake-Up Call! Tell the server we are loaded <---
            chrome.runtime.sendMessage({ 
                action: "join_room", 
                roomId: inviteId,
                isWakeUp: true // This tells the worker to block the infinite loop
            });

            // D. CRITICAL: Erase the memory!
            chrome.storage.local.remove(['storedRoom', 'inviteLink']);
        }
    });
})();

setInterval(add, 2000);