const SyncEngine = require("../modules/sync/sync.engine");

let syncEngine;

module.exports = (io, socket) => {
  if (!syncEngine) {
    syncEngine = new SyncEngine(io);
  }

  const isBoundRoomMember = (roomCode) =>
    typeof roomCode === "string" &&
    socket.boundRoomCode === roomCode &&
    socket.rooms.has(roomCode) &&
    typeof socket.playerRecordId === "string";

  socket.on("optimistic-answer", (data = {}) => {
    const { roomCode, tempScore } = data;
    if (!isBoundRoomMember(roomCode) || !Number.isFinite(tempScore) || tempScore < 0 || tempScore > 1000000) {
      socket.emit("error", { message: "Invalid optimistic score update" });
      return;
    }

    syncEngine.optimisticUpdate({
      roomCode,
      playerId: socket.playerRecordId,
      tempScore
    });
  });

  socket.on("confirm-answer", async (data, callback = () => {}) => {
    try {
      if (!isBoundRoomMember(data?.roomCode)) {
        callback({ success: false, message: "Join the room before submitting an answer" });
        return;
      }

      const serverScore = await syncEngine.serverValidate({
        roomCode: data.roomCode,
        playerId: socket.playerRecordId,
        questionId: data.questionId,
        answer: data.answer,
        responseStart: data.responseStart,
        responseEnd: Date.now()
      });

      callback({ success: true, serverScore });
    } catch (err) {
      console.error("Sync answer validation failed:", err.message);
      callback({ success: false, message: "Unable to confirm answer" });
    }
  });

  socket.on("sync-reconcile", async ({ roomCode } = {}) => {
    if (!isBoundRoomMember(roomCode)) {
      socket.emit("error", { message: "Join the room before requesting reconciliation" });
      return;
    }

    try {
      await syncEngine.reconcile(roomCode);
    } catch (err) {
      console.error("Sync reconciliation failed:", err.message);
      socket.emit("error", { message: "Unable to reconcile scores" });
    }
  });
};
