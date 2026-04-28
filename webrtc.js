// ==========================================
// 1. GLOBAL STATE & CONFIGURATION
// ==========================================
let localStream;
const peers = {}; // Dictionary to hold 1-to-1 connections (key: remoteUserId)

const rtcConfig = {
    'iceServers': [
        {'urls': 'stun:stun.l.google.com:19302'},
        {'urls': 'stun:stun1.l.google.com:19302'}
    ]
};

// ==========================================
// 2. LOCAL MEDIA CONTROLS
// ==========================================
async function startLocalVideo() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        const localVideo = document.createElement('video');
        localVideo.srcObject = localStream;
        localVideo.autoplay = true;
        localVideo.playsInline = true;
        localVideo.muted = true; // Prevents you from hearing yourself
        
        localVideo.style.cssText = "width: 100%; border-radius: 8px; border: 2px solid #4CAF50; background: #000; transform: scaleX(-1);";
        
        const videoGrid = document.getElementById('video-grid');
        if (videoGrid) {
            videoGrid.appendChild(localVideo);
            console.log("WebRTC: Local camera started.");
        }
    } catch (error) {
        console.error("WebRTC Error: Camera access denied.", error);
        const videoGrid = document.getElementById('video-grid');
        if(videoGrid) {
            videoGrid.innerHTML = `<p style="color: red; font-size: 12px; text-align: center;">Camera/Mic access denied.</p>`;
        }
    }
}

function toggleMic() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            return audioTrack.enabled;
        }
    }
    return false;
}

function toggleCamera() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            return videoTrack.enabled;
        }
    }
    return false;
}

// ==========================================
// 3. THE CALLER (Initiates the connection)
// ==========================================
function webConnect(remoteId) {
    console.log("1. webConnect started for:", remoteId);

    const sidebar = document.getElementById('side_bar');
    const currentRoom = sidebar ? sidebar.dataset.roomId : null;
    
    console.log("2. Room ID found:", currentRoom);

    if (!currentRoom) {
        console.error("❌ SILENT DEATH: Cannot send offer, no Room ID found on the sidebar!");
        return;
    }

    console.log("3. Creating Peer Connection...");
    const pc = new RTCPeerConnection(rtcConfig);
    peers[remoteId] = pc;

    // The Ultimate Pipe Debugger
    pc.onconnectionstatechange = () => console.log(`PIPE STATUS [${remoteId}]:`, pc.connectionState);

    console.log("4. Adding local camera to pipe...");
    if (typeof localStream !== 'undefined' && localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        console.log("-> Camera added successfully.");
    } else {
        console.warn("-> No local camera found! Sending a video-less offer.");
    }

    // Network Routing (Trickle ICE)
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            chrome.runtime.sendMessage({ 
                action: 'send_ice_candidate', 
                candidate: event.candidate, 
                roomId: currentRoom, 
                target: remoteId 
            });
        }
    };

    // Catch Remote Video
    pc.ontrack = (event) => {
        console.log("🔥 VIDEO ARRIVED from:", remoteId);
        let remoteVideo = document.getElementById(`video-${remoteId}`);
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = `video-${remoteId}`;
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            // CRITICAL: Mute remote video initially to prevent Chrome Autoplay blocks
            remoteVideo.muted = true; 
            remoteVideo.style.cssText = "width: 100%; border-radius: 8px; border: 2px solid #2196F3; background: #000;";
            const videoGrid = document.getElementById('video-grid');
            if (videoGrid) videoGrid.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
    };

    console.log("5. Waiting 2.5 seconds for their page to finish refreshing...");
    
    // DELAY THE CALL BY 2.5 SECONDS TO FIX THE RACE CONDITION
    setTimeout(() => {
        (async () => {
            try {
                let offer = await pc.createOffer();
                console.log("6. Offer generated, setting local description...");
                await pc.setLocalDescription(offer);
                
                console.log("7. 📤 Sending offer to worker to mail to:", remoteId);
                chrome.runtime.sendMessage({ 
                    action: 'sendoffer', 
                    offer: pc.localDescription, 
                    roomId: currentRoom, 
                    target: remoteId 
                });
            } catch (error) {
                console.error("❌ WebRTC Error generating offer:", error);
            }
        })();
    }, 2500); 
}

// ==========================================
// 4. THE ANSWERER (Receives Offer -> Sends Answer)
// ==========================================
async function handleReceiveOffer(remoteId, offerSdp) {
    console.log("A. 📥 handleReceiveOffer started for:", remoteId);

    const sidebar = document.getElementById('side_bar');
    const currentRoom = sidebar ? sidebar.dataset.roomId : null;
    if (!currentRoom) {
        console.error("❌ SILENT DEATH: No Room ID found for answering!");
        return;
    }

    console.log("B. Creating Peer Connection for Answer...");
    const pc = new RTCPeerConnection(rtcConfig);
    peers[remoteId] = pc;
    
    // The Ultimate Pipe Debugger
    pc.onconnectionstatechange = () => console.log(`PIPE STATUS [${remoteId}]:`, pc.connectionState);

    console.log("C. Adding local camera to answer pipe...");
    if (typeof localStream !== 'undefined' && localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    } else {
        console.warn("-> No local camera found for answerer!");
    }

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            chrome.runtime.sendMessage({ action: 'send_ice_candidate', candidate: event.candidate, roomId: currentRoom, target: remoteId });
        }
    };

    pc.ontrack = (event) => {
        console.log("🔥 VIDEO ARRIVED (Answerer Side) from:", remoteId);
        let remoteVideo = document.getElementById(`video-${remoteId}`);
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = `video-${remoteId}`;
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.muted = true; // Prevents autoplay block
            remoteVideo.style.cssText = "width: 100%; border-radius: 8px; border: 2px solid #E91E63; background: #000;";
            const videoGrid = document.getElementById('video-grid');
            if (videoGrid) videoGrid.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
    };

    try {
        console.log("D. Setting Remote Description (The Offer)...");
        await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
        
        console.log("E. Creating Answer...");
        const answer = await pc.createAnswer();
        
        console.log("F. Setting Local Description (The Answer)...");
        await pc.setLocalDescription(answer);
        
        console.log("G. 📤 Sending Answer back to worker for:", remoteId);
        chrome.runtime.sendMessage({ action: 'sendanswer', answer: pc.localDescription, roomId: currentRoom, target: remoteId });
    } catch (error) {
        console.error("❌ WebRTC Error handling offer:", error);
    }
}

// ==========================================
// 5. THE FINISHERS (Completes the Handshake)
// ==========================================
async function handleReceiveAnswer(remoteId, answerSdp) {
    const pc = peers[remoteId];
    if (pc) {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
            console.log(`WebRTC: Connection established with ${remoteId}!`);
        } catch (error) {
            console.error("WebRTC Error setting remote description:", error);
        }
    }
}

async function handleNewICECandidate(remoteId, candidate) {
    const pc = peers[remoteId];
    if (pc && candidate) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error("WebRTC Error adding ICE candidate:", error);
        }
    }
}

// ==========================================
// 6. MESSAGE LISTENER (Listens to Background Worker)
// ==========================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'new_user_joined') {
        console.log("📢 LISTENER FIRED: New user joined! Initiating call to:", msg.userId);
        webConnect(msg.userId);
    } 
    else if (msg.action === 'receive_offer') {
        handleReceiveOffer(msg.userId, msg.offer);
    } 
    else if (msg.action === 'receive_answer') {
        handleReceiveAnswer(msg.userId, msg.answer);
    } 
    else if (msg.action === 'receive_ice_candidate') {
        handleNewICECandidate(msg.userId, msg.candidate);
    }
});