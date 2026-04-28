import { io } from "./socket.io.esm.min.js"; 

console.log("Worker started!");

// Connect to server
const socket = io("http://43.204.236.100:3000", {
    transports: ["websocket"]
});

socket.on("connect_error", (err) => {
    console.log("CONNECTION ERROR:", err.message); 
});

socket.on("disconnect", () => {
    console.log("Socket disconnected"); 
});

let currentRoom = false;
let blockNextReload = false; // THE SHIELD: Prevents the infinite loop

socket.on("connect", () => {
    console.log("Socket Connected:", socket.id);
    if (currentRoom) {
        console.log("Re-joining room after reconnect:", currentRoom);
        socket.emit("join_room", currentRoom);
    }
});

// --- HELPER: BROADCAST TO ALL TABS ---
function sendToContentScript(payload) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, payload).catch(() => {}); 
        });
    });
}

// ==========================================
// 1. LISTEN TO POPUP / CONTENT SCRIPT
// ==========================================
chrome.runtime.onMessage.addListener((msg) => {

    // --- WEBRTC: OUTGOING SIGNALS ---
    if (msg.action === 'sendoffer') {
        socket.emit('webrtc_offer', { target: msg.target, roomId: msg.roomId, offer: msg.offer });
    }
    if (msg.action === 'sendanswer') {
        socket.emit('webrtc_answer', { target: msg.target, roomId: msg.roomId, answer: msg.answer });
    }
    if (msg.action === 'send_ice_candidate') {
        socket.emit('webrtc_ice_candidate', { target: msg.target, roomId: msg.roomId, candidate: msg.candidate });
    }

    // --- ROOM & SYNC SIGNALS ---
    if(msg.action == "room_created"){
        currentRoom = msg.roomId;
        console.log("room created", msg.roomId);
        socket.emit("room_created", {roomId: msg.roomId, inviteLink: msg.inviteLink});
    }
    
    if (msg.action === "join_room") {
        currentRoom = msg.roomId;
        
        // If this is a wake-up call from the page reload, block the server from reloading us again!
        if (msg.isWakeUp) {
            blockNextReload = true; 
        } else {
            blockNextReload = false; // Normal manual join
        }
        
        socket.emit("join_room", currentRoom);
    }

    if(msg.action === "pause"){
        socket.emit('pause', { roomId: currentRoom, action: "pause" });
    }
    if(msg.action == "resume"){
        socket.emit('resume', { roomId: currentRoom, action: "resume" });
    }
    if(msg.action == "C2"){
        socket.emit("chat_message", { message: msg.text, roomId: msg.roomId });
    }
    if (msg.action === "user-seeked") {
        if (currentRoom) {
            socket.emit("video_action", { roomId: currentRoom, action: "seek", time: msg.seekat });
        }
    }
    if(!currentRoom && msg.action == "add_sideBar"){
        console.log("room initiated for the first time");
        socket.emit("room_created", {roomId: msg.roomId, inviteLink: msg.inviteLink});
    }
});

// ==========================================
// 2. LISTEN TO SERVER
// ==========================================

// --- SYNC & CHAT SIGNALS ---
socket.on("pause", () => {
    sendToContentScript({ action: "pause" });
});

socket.on("resume", () => {
    sendToContentScript({ action: "resume" });
});

socket.on("receive_chat", (data) => {
    sendToContentScript({ action: "receive_chat", text: data.message });
});

socket.on("receive_action", (data) => {
    sendToContentScript({ action: "remote_seek", time: data.time });
});

socket.on("init_room", ({roomId, inviteLink}) => {
    // 🔥 THE SHIELD: Block the infinite loop!
    if (blockNextReload) {
        console.log("Wake up complete. Blocking infinite loop reload.");
        blockNextReload = false; // Reset it for next time
        return; 
    }

    chrome.storage.local.set({
        storedRoom: roomId,
        inviteLink: inviteLink
    }, () => {
        chrome.tabs.update({url: inviteLink});
    });
});

// --- WEBRTC: INCOMING SIGNALS ---
socket.on("new_user_joined", (newUserId) => {
    console.log("Worker: New user joined, telling page to connect:", newUserId);
    sendToContentScript({ action: "new_user_joined", userId: newUserId });
});

socket.on("receive_offer", (data) => {
    console.log("Worker: Relaying Offer to page...");
    sendToContentScript({ action: "receive_offer", offer: data.offer, userId: data.callerId });
});

socket.on("receive_answer", (data) => {
    console.log("Worker: Relaying Answer to page...");
    sendToContentScript({ action: "receive_answer", answer: data.answer, userId: data.answererId });
});

socket.on("receive_ice_candidate", (data) => {
    sendToContentScript({ action: "receive_ice_candidate", candidate: data.candidate, userId: data.senderId });
});