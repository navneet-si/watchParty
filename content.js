

let isRemoteUpdate = false; // <--- THE LOCK

function add() {
  const video = document.getElementsByTagName('video')[0];
  // Only add listener if video exists AND we haven't added it yet
  if (video && !video.dataset.listenerAttached) {
      video.dataset.listenerAttached = "true";
      console.log("Video listener attached!");

      // --- OUTGOING: User moves the bar --

      video.addEventListener('pause',()=>{
          console.log("paused");
          if(isRemoteUpdate){
            isRemoteUpdate = false;
            return;
          }

          chrome.runtime.sendMessage({
            action:"pause"
          })

      })


      video.addEventListener('play',()=>{
          console.log("resume");
          if(isRemoteUpdate){
            isRemoteUpdate = false;
            return;
          }
          
          // let sidebar = document.getElementById("side_bar");  
          
          // if(!sidebar)return;

          // let room = sidebar.dataset.roomId;
          // if(room){
            chrome.runtime.sendMessage({
              action:"resume",
              roomId: room
            })
          // }

      })

      video.addEventListener('seeked', () => {
        // If the code moved the bar, IGNORE this event
        if (isRemoteUpdate) {
            isRemoteUpdate = false; // Reset lock
            return; 
        }
        const time = video.currentTime;
        console.log("User seeked to:", time);
        
        try {
          chrome.runtime.sendMessage({
            action: "user-seeked",
            seekat: time
          });
        } catch (e) {
          console.error();
        }
      });
  }
}

// --- INCOMING: Server moves the bar ---
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "remote_seek") {
        const video = document.querySelector('video');
        if (video) {
            console.log("Moving video to:", msg.time);
            
            isRemoteUpdate = true; // <--- LOCK ON
            video.currentTime = msg.time; // This triggers 'seeked', but lock catches it
        }
    }

    if(msg.action == "pause"){
      const video = document.querySelector('video');
      if(video){
        isRemoteUpdate = true;
        video.pause();
      }
    }

    if(msg.action == "resume"){
      const video = document.querySelector('video');
      if(video){
        isRemoteUpdate = true;
        video.play();
      }
    }



    if(msg.action == "add_sideBar"){
      sideBar();
      const id = document.getElementById('side_bar');
      if(id){
        id.dataset.roomId = msg.roomId;
        id.dataset.inviteLink = msg.inviteLink;
      }
    }

});
 
(function checkUrlForInvite() {
    // 1. Read from Chrome Storage (ASYNC)
    // We ask for an array of strings matching the exact names we saved in the worker
    chrome.storage.local.get(['storedRoom', 'inviteLink'], (result) => {
        
        const inviteId = result.storedRoom;
        const urlParams = result.inviteLink;

        // 2. If we found a room ID in memory...
        if (inviteId) {
            console.log("Found Invite Code in memory! Auto-joining:", inviteId);

            // A. Open the UI immediately
            if (typeof sideBar === "function") sideBar(); 

            // B. Stamp the ID onto the sidebar so Chat/Sync works
            const sidebar = document.getElementById('side_bar');
            if (sidebar) {
                sidebar.dataset.roomId = inviteId;
                sidebar.dataset.inviteLink = urlParams; 
                
                // Auto-connect the chat with a welcome message
                const chat = document.getElementById('sync-chat');
                if(chat) {
                    chat.innerHTML += `<p style="color:#2196F3; font-size:12px;"><strong>System:</strong> Auto-joined Room via Link!</p>`;
                }
            }

            // C. Tell the Background Worker to connect the Socket

            // D. CRITICAL: Erase the memory!
            // If we don't do this, every new video you open will try to join this room.
            chrome.storage.local.remove(['storedRoom', 'inviteLink']);
        }
    });
})();


setInterval(add, 2000); 