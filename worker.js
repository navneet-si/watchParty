import { io } from "./socket.io.esm.min.js"; 

console.log("Worker started!");

// Connect to server
const socket = io("http://43.204.236.100:3000",{
    transports: ["websocket"]
}
);


socket.on("connect_error", (err) => {
    console.log("CONNECTION ERROR:", err.message); 
});6

socket.on("disconnect", () => {
    console.log("Socket disconnected"); 
});

let currentRoom = false;

socket.on("connect", () => {
console.log("Socket Connected:", socket.id);
if (currentRoom) {
            console.log("Re-joining room after reconnect:", currentRoom);
            socket.emit("join_room", currentRoom);
        }
});


// --- LISTEN TO POPUP ---

chrome.runtime.onMessage.addListener((msg) => {


    // --- WEBRTC: OUTGOING SIGNALS (From Page -> To Server) ---
    if (msg.action === 'sendoffer') {
        socket.emit('webrtc_offer', {
            target: msg.target, // The specific user this is for
            roomId: msg.roomId,
            offer: msg.offer
        });
    }

    if (msg.action === 'sendanswer') {
        socket.emit('webrtc_answer', {
            target: msg.target,
            roomId: msg.roomId,
            answer: msg.answer
        });
    }

    if (msg.action === 'send_ice_candidate') {
        socket.emit('webrtc_ice_candidate', {
            target: msg.target,
            roomId: msg.roomId,
            candidate: msg.candidate
        });
    }

    if(msg.action == "room_created"){
            currentRoom = msg.roomId;
            console.log("room created");
            console.log(msg.roomId);
            socket.emit("room_created",{roomId:msg.roomId,inviteLink:msg.inviteLink});
    }

    if (msg.action === "join_room") {
        currentRoom = msg.roomId;
        socket.emit("join_room", currentRoom);
    }
    
    if(msg.action === "pause"){
        socket.emit('pause',{
            roomId: currentRoom,
            action: "pause",
        })
    }

    if(msg.action == "resume"){
        socket.emit('resume',{
            roomId: currentRoom,
            action: "resume"
        })
    }

    if(msg.action == "C2"){
        socket.emit("chat_message",{
            message: msg.text,
            roomId: msg.roomId,
        })
    }



    if (msg.action === "user-seeked") {
        // Now this will work because currentRoom is set to "TEST"
        if (currentRoom) {
            console.log(`Sending seek to ${currentRoom}: ${msg.seekat}`);
            socket.emit("video_action", {
                roomId: currentRoom,
                action: "seek",
                time: msg.seekat
            });
        } else {
            console.log("Ignored seek: Not in a room");
        }
    }
    if(!currentRoom){
        console.log("room initiated for the first time");
        if(msg.action == "add_sideBar"){
            socket.emit("room_created",{roomId:msg.roomId ,inviteLink: msg.inviteLink});
        }
    }
});

// --- LISTEN TO SERVER ---

socket.on("pause",()=>{
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "pause", 
            });
        }
    });

})

socket.on("resume",(data)=>{
    chrome.tabs.query({active:true , currentWindow: true},(tabs)=>{
        if(tabs[0]){
            chrome.tabs.sendMessage(tabs[0].id,{
                action: "resume",
            })
        }
    })
})

socket.on("init_room",({roomId,inviteLink})=>{
    chrome.storage.local.set({
        storedRoom: roomId,
        inviteLink: inviteLink
    },()=>{
        chrome.tabs.update({url:inviteLink});
    })
})

socket.on("receive_chat", (data) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "receive_chat",
                text: data.message
            });
        }
    });
});

socket.on("receive_action", (data) => {
    console.log("Server says move video to:", data.time);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "remote_seek", 
                time: data.time
            });
        }
    });
});

// --- WEBRTC: INCOMING SIGNALS (From Server -> To Page) ---

// 1. Someone joined the room. Tell the page to initiate a call!
socket.on("new_user_joined", (newUserId) => {
    console.log("Worker: New user joined, telling page to connect:", newUserId);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "new_user_joined",
                userId: newUserId
            });
        }
    });
});

// 2. Incoming Offer
socket.on("receive_offer", (data) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "receive_offer",
                offer: data.offer,
                userId: data.callerId // ID of the person calling us
            });
        }
    });
});

// 3. Incoming Answer
socket.on("receive_answer", (data) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "receive_answer",
                answer: data.answer,
                userId: data.answererId
            });
        }
    });
});

// 4. Incoming ICE Candidate (Network Route)
socket.on("receive_ice_candidate", (data) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "receive_ice_candidate",
                candidate: data.candidate,
                userId: data.senderId
            });
        }
    });
});