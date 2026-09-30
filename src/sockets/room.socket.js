const RoomService = require("../modules/rooms/room.service");

module.exports = (io, socket) => {

  // helper to broadcast full room updates
  const broadcastRoomUpdate = async (roomCode) => {
    try {
      const roomData = await RoomService.getRoom(roomCode);
      const players = roomData.players.map(p => ({
        id: p.id,
        username: p.username,
        isHost: p.user_id === roomData.room.host_id
      }));

      io.to(roomCode).emit("room:update", {
        id: roomData.room.id,
        roomCode: roomData.room.room_code,
        roomName: roomData.room.room_name,
        syncMode: roomData.room.sync_mode,
        delayLevel: roomData.room.delay_level,
        delayMs: roomData.room.delay_ms,
        hostId: roomData.room.host_id,
        players
      });
    } catch (err) {
      console.error("Error broadcasting room update:", err.message);
    }
  };

  // 🎯 CREATE ROOM EVENT
  socket.on("create-room", async ({ hostId, quizId, syncMode, delayLevel, delayMs }, callback = () => {}) => {
    try {
      if (!socket.user?.userId || String(socket.user.userId) !== String(hostId)) {
        throw new Error("Only an authenticated room creator can create the room");
      }

      const room = await RoomService.createRoom(hostId, quizId, {
        syncMode,
        delayLevel,
        delayMs
      });

      socket.join(room.room_code);
      socket.playerId = socket.user.userId;

      callback({
        success: true,
        room
      });

      socket.emit("room-created", { room });
      await broadcastRoomUpdate(room.room_code);

    } catch (err) {
      callback({
        success: false,
        message: err.message
      });
    }
  });

  // 🎯 JOIN ROOM EVENT
  socket.on("join-room", async ({ roomCode, player }, callback = () => {}) => {
    try {
      const trustedPlayer = socket.user?.userId
        ? { ...player, id: socket.user.userId }
        : player;
      const result = await RoomService.joinRoom(roomCode, trustedPlayer);

      socket.join(roomCode);
      socket.playerId = result.player.user_id;
      socket.username = result.player.username;

      callback({
        success: true,
        room: result.room,
        player: result.player
      });

      await broadcastRoomUpdate(roomCode);

    } catch (err) {
      callback({
        success: false,
        message: err.message
      });
    }
  });

};
