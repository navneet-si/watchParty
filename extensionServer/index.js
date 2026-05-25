const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const app = express();
const server = http.createServer(app);

// In-memory fallback store for room links when Redis is not available
const roomLinks = new Map();

async function startServer() {
    let redisAvailable = false;

    try {
        await redisClient.connect();
        redisAvailable = true;
        console.log('Redis Client Connected');
    } catch (err) {
        console.error('Redis not available, falling back to in-memory store:', err && err.message ? err.message : err);
    }

    // Configure Socket.io with permissive CORS
    const io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    // If Redis is available, setup pub/sub adapter for cross-instance messaging
    if (redisAvailable) {
        try {
            const pubClient = redisClient.duplicate();
            const subClient = redisClient.duplicate();
            await pubClient.connect();
            await subClient.connect();
            io.adapter(createAdapter(pubClient, subClient));
            console.log('Socket.IO Redis adapter configured');
        } catch (err) {
            console.error('Failed to configure Redis adapter, continuing without it:', err);
            redisAvailable = false; // fall back if adapter setup fails
        }
    } else {
        console.warn('Running without Redis adapter — broadcasts will be local to this process only');
    }

    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        // ROOM MANAGEMENT
        socket.on('room_created', async (data) => {
            try {
                const { roomId, inviteLink } = data;
                if (redisAvailable) {
                    await redisClient.set(`room:${roomId}:link`, inviteLink);
                } else {
                    roomLinks.set(roomId, inviteLink);
                }
                socket.join(roomId);
                console.log(`Room created: ${roomId} by ${socket.id}`);
            } catch (err) {
                console.error('Failed to store room link:', err);
            }
        });

        socket.on('join_room', async (roomId) => {
            try {
                socket.join(roomId);
                console.log(`User ${socket.id} joined room: ${roomId}`);
                socket.to(roomId).emit('new_user_joined', socket.id);

                let inviteLink;
                if (redisAvailable) {
                    inviteLink = await redisClient.get(`room:${roomId}:link`);
                } else {
                    inviteLink = roomLinks.get(roomId);
                }

                if (inviteLink) {
                    socket.emit('init_room', { roomId, inviteLink });
                }
            } catch (err) {
                console.error('Failed during join_room:', err);
            }
        });

        // VIDEO SYNCHRONIZATION
        socket.on('pause', (data) => {
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

        // TEXT CHAT
        socket.on('chat_message', (data) => {
            socket.to(data.roomId).emit('receive_chat', { message: data.message });
        });

        // WEBRTC SIGNALING
        socket.on('webrtc_offer', (data) => {
            io.to(data.target).emit('receive_offer', {
                offer: data.offer,
                callerId: socket.id
            });
        });

        socket.on('webrtc_answer', (data) => {
            io.to(data.target).emit('receive_answer', {
                answer: data.answer,
                answererId: socket.id
            });
        });

        socket.on('webrtc_ice_candidate', (data) => {
            io.to(data.target).emit('receive_ice_candidate', {
                candidate: data.candidate,
                senderId: socket.id
            });
        });

        // CLEANUP
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });

    // Start the server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Sync Server is running on port ${PORT}`);
    });
}

startServer();