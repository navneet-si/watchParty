const { Server } = require("socket.io");

const io = new Server(3000, {
  cors: {
    origin: "*", // Allow connections from Chrome Extension
  }
});

console.log("Socket Server started on port 3000");

const rooms = new Map();

io.on("connection", (socket) => {


  // 1. ANNOUNCE NEW USERS
    // Make sure you add this inside your existing 'join_room' event!
    socket.on("join_room", (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
        
        // Broadcast to everyone ELSE in the room that this user joined
        // This triggers them to start generating WebRTC Offers
        socket.to(roomId).emit("new_user_joined", socket.id); 
    });

    // 2. THE WEBRTC MAILMAN (Targeted Routing)
    
    // Route Offers
    socket.on("webrtc_offer", (data) => {
        // We use socket.to(data.target) instead of socket.to(room)
        // This ensures the highly-encrypted offer ONLY goes to the right person
        socket.to(data.target).emit("receive_offer", {
            offer: data.offer,
            callerId: socket.id // We attach the sender's ID so the receiver knows who called
        });
    });

    // Route Answers
    socket.on("webrtc_answer", (data) => {
        socket.to(data.target).emit("receive_answer", {
            answer: data.answer,
            answererId: socket.id
        });
    });

    // Route ICE Candidates
    socket.on("webrtc_ice_candidate", (data) => {
        socket.to(data.target).emit("receive_ice_candidate", {
            candidate: data.candidate,
            senderId: socket.id
        });
    });

  socket.on("room_created",({roomId,inviteLink})=>{
      socket.join(roomId);
      rooms.set(roomId,inviteLink);
  })

  // --- 1. JOIN ROOM & AUTO-SYNC ---
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    socket.emit("init_room",{roomId:roomId,inviteLink:rooms.get(roomId)});
    // Check if there are already people in the room
    // const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;

    // // If room has people, ask the *existing* users for the current time
    // if (roomSize > 1) {
    //     // Send to everyone else in the room
    //     socket.to(roomId).emit("ask_time", { 
    //         requesterId: socket.id // Send new user's ID so we know who to reply to
    //     });
    // }
  });

  // --- 2. HANDLE TIME SYNC RESPONSE ---
  // Existing user replies: "We are at 10:45"
  socket.on("sync_time", (data) => {
      console.log(`Syncing time for new user ${data.requesterId} to ${data.time}`);
      // Send this ONLY to the specific person who just joined
      io.to(data.requesterId).emit("receive_action", {
          action: "remote_seek",
          time: data.time
      });
  });

  // --- 3. VIDEO CONTROLS ---
  socket.on("video_action", (data) => {
    // Broadcast Seek (excluding sender)
    socket.to(data.roomId).emit("receive_action", data);
  });

  socket.on("pause", (data) => {
    console.log("paused");
    socket.to(data.roomId).emit("pause");
  });

  socket.on("resume", (data) => {
    console.log(`Resume in ${data.roomId}`);
    socket.to(data.roomId).emit("resume");
  });

  // --- 4. CHAT ---
  socket.on("chat_message", (data) => {
    console.log(`Chat in ${data.roomId}: ${data.message}`);
    socket.to(data.roomId).emit("receive_chat", {
        message: data.message
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});