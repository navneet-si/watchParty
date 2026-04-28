const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 1. Configure Socket.io with permissive CORS
// Since your extension runs on YouTube, Netflix, and Hotstar, 
// the requests come from different domains. We use "*" to allow them all.
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// A simple memory store to remember invite links for specific rooms
const roomLinks = {}; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // ==========================================
    // ROOM MANAGEMENT
    // ==========================================

    // When the Host clicks "Create Room"
    socket.on('room_created', (data) => {
        const { roomId, inviteLink } = data;
        roomLinks[roomId] = inviteLink; // Save the link in server memory
        socket.join(roomId);            // Put the host into the socket room
        console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    // When a Guest joins via link or enters an ID
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        
        // Tell everyone ELSE in the room that a new person arrived.
        // This is what triggers the WebRTC 'webConnect()' function on Profile A!
        socket.to(roomId).emit('new_user_joined', socket.id);

        // If the server remembers the invite link for this room, send it to the guest.
        // This triggers the 'init_room' listener in your worker.js
        if (roomLinks[roomId]) {
            socket.emit('init_room', { roomId, inviteLink: roomLinks[roomId] });
        }
    });


    // ==========================================
    // VIDEO SYNCHRONIZATION
    // ==========================================

    socket.on('pause', (data) => {
        // socket.to() sends the pause command to everyone in the room EXCEPT the person who clicked it
        socket.to(data.roomId).emit('pause');
    });

    socket.on('resume', (data) => {
        socket.to(data.roomId).emit('resume');
    });

    socket.on('video_action', (data) => {
        if (data.action === 'seek') {
            console.log(`Seek action in ${data.roomId} to ${data.time}`);
            socket.to(data.roomId).emit('receive_action', { time: data.time });
        }
    });


    // ==========================================
    // TEXT CHAT
    // ==========================================

    socket.on('chat_message', (data) => {
        // Broadcasts the chat text to the other people in the room
        socket.to(data.roomId).emit('receive_chat', { message: data.message });
    });


    // ==========================================
    // WEBRTC SIGNALING (The Post Office)
    // ==========================================
    // WebRTC requires the two browsers to trade IPs and security keys before they 
    // can connect video. This server acts as the middleman (Signaling Server) to trade the data.

    // 1. Host sends an Offer -> Forward it to the Guest
    socket.on('webrtc_offer', (data) => {
        io.to(data.target).emit('receive_offer', {
            offer: data.offer,
            callerId: socket.id // Let the guest know who is calling
        });
    });

    // 2. Guest replies with an Answer -> Forward it back to the Host
    socket.on('webrtc_answer', (data) => {
        io.to(data.target).emit('receive_answer', {
            answer: data.answer,
            answererId: socket.id
        });
    });

    // 3. Both browsers send ICE Candidates (IP network routes) -> Swap them
    socket.on('webrtc_ice_candidate', (data) => {
        io.to(data.target).emit('receive_ice_candidate', {
            candidate: data.candidate,
            senderId: socket.id
        });
    });


    // ==========================================
    // CLEANUP
    // ==========================================
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Socket.io automatically removes disconnected users from their rooms, 
        // so we don't have to manually delete them!
    });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Sync Server is running on port ${PORT}`);
});