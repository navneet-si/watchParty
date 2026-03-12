import { io } from "./socket.io.esm.min.js"; 

console.log("Worker started!");

// Connect to server
const socket = io("http://localhost:3000",{
    transports: ["websocket"]
}
);


socket.on("connect_error", (err) => {
    console.log("CONNECTION ERROR:", err.message); 
});

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

// 