const roomSocket = require("./room.socket");
const gameSocket = require("./game.socket");
const syncSocket = require("./sync.socket");

function initSockets(io) {
  io.on("connection", (socket) => {

    console.debug("Socket connected:", socket.id);

    let windowStartedAt = Date.now();
    let eventCount = 0;
    socket.onAny(() => {
      const now = Date.now();
      if (now - windowStartedAt >= 10_000) {
        windowStartedAt = now;
        eventCount = 0;
      }

      eventCount += 1;
      if (eventCount > 100) {
        console.warn("Disconnecting socket for excessive client events:", socket.id);
        socket.disconnect(true);
      }
    });

    roomSocket(io, socket);
    gameSocket(io, socket);
    syncSocket(io, socket);

    socket.on("disconnect", () => {
      console.debug("Socket disconnected:", socket.id);
    });
  });
}

module.exports = initSockets;