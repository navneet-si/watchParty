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
    const sidebar = document.getElementById('side_bar');
    const currentRoom = sidebar ? sidebar.dataset.roomId : null;
    if (!currentRoom) return;

    // Create a dedicated pipe for this user
    const pc = new RTCPeerConnection(rtcConfig);
    peers[remoteId] = pc;

    // Plug in local camera
    if (typeof localStream !== 'undefined' && localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
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
        let remoteVideo = document.getElementById(`video-${remoteId}`);
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = `video-${remoteId}`;
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.style.cssText = "width: 100%; border-radius: 8px; border: 2px solid #2196F3; background: #000;";
            const videoGrid = document.getElementById('video-grid');
            if (videoGrid) videoGrid.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
    };

    // Create and Send Offer
    (async () => {
        try {
            let offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            chrome.runtime.sendMessage({ 
                action: 'sendoffer', 
                offer: pc.localDescription, 
                roomId: currentRoom, 
                target: remoteId 
            });
        } catch (error) {
            console.error("WebRTC Error generating offer:", error);
        }
    })();
}

// ==========================================
// 4. THE ANSWERER (Receives Offer -> Sends Answer)
// ==========================================
async function handleReceiveOffer(remoteId, offerSdp) {
    const sidebar = document.getElementById('side_bar');
    const currentRoom = sidebar ? sidebar.dataset.roomId : null;
    if (!currentRoom) return;

    const pc = new RTCPeerConnection(rtcConfig);
    peers[remoteId] = pc;

    if (typeof localStream !== 'undefined' && localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

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

    pc.ontrack = (event) => {
        let remoteVideo = document.getElementById(`video-${remoteId}`);
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.id = `video-${remoteId}`;
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.style.cssText = "width: 100%; border-radius: 8px; border: 2px solid #2196F3; background: #000;";
            const videoGrid = document.getElementById('video-grid');
            if (videoGrid) videoGrid.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
    };

    // The Handshake
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        chrome.runtime.sendMessage({ 
            action: 'sendanswer', 
            answer: pc.localDescription, 
            roomId: currentRoom, 
            target: remoteId 
        });
    } catch (error) {
        console.error("WebRTC Error handling offer:", error);
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
        // Triggered when server says a new person entered the room
        console.log("New user joined! Initiating call to:", msg.userId);
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