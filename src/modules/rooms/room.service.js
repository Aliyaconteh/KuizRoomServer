const RoomRepository = require("./room.repository");
const RoomUtils = require("./room.utils");
const { ROOM_STATUS } = require("./room.constants");
const { supabaseAdmin } = require("../../config/supabase.config");

class RoomService {

  // CREATE ROOM
  async createRoom(hostId, quizId, options = {}) {
    if (!hostId) throw new Error("Host ID is required");

    const username = options.username || options.roomName || "Host";
    await this.ensureHostUser(hostId, username);

    const roomCode = await this.generateUniqueRoomCode();
    const delay = RoomUtils.resolveDelay(options.delayLevel, options.delayMs);
    const syncMode = options.syncMode || "server";

    if (!["server", "optimistic"].includes(syncMode)) {
      throw new Error("syncMode must be either 'server' or 'optimistic'");
    }

    const room = await RoomRepository.createRoom({
      room_code: roomCode,
      host_id: hostId,
      username,
      quiz_id: quizId,
      room_name: options.roomName,
      sync_mode: syncMode,
      delay_level: delay.level,
      delay_ms: delay.ms,
      status: ROOM_STATUS.WAITING
    });

    return room;
  }

  async ensureHostUser(hostId, username) {
    const { error } = await supabaseAdmin
      .from("users")
      .upsert([{
        id: hostId,
        username
      }], { onConflict: "id" });

    if (error) {
      throw new Error(`Could not prepare host user: ${error.message}`);
    }
  }

  // 🚪 JOIN ROOM
  async joinRoom(roomCode, user) {
    if (!RoomUtils.isValidRoomCode(roomCode)) {
      throw new Error("Invalid room code");
    }

    if (!user?.username) {
      throw new Error("Username is required");
    }

    const room = await RoomRepository.getRoomByCode(roomCode);

    if (!room) throw new Error("Room not found");
    if (room.status !== ROOM_STATUS.WAITING) {
      throw new Error("Room is not accepting new players");
    }

    const existingPlayer = await RoomRepository.getPlayerByUsername(
      room.id,
      user.username
    );

    if (existingPlayer) {
      if (String(existingPlayer.user_id) !== String(user.id || user.userId || user.hostId || "")) {
        throw new Error("That username is already being used in this room");
      }

      return {
        room,
        player: existingPlayer
      };
    }

    const userId = user.id || user.userId || user.hostId || `player_${Date.now()}`;
    const player = await RoomRepository.addPlayer(room.id, {
      user_id: userId,
      username: user.username
    });

    return {
      room,
      player
    };
  }

  // ▶ START ROOM
  async startRoom(roomCode, hostId) {
    const room = await RoomRepository.getRoomByCode(roomCode);
    if (!room) throw new Error("Room not found");
    if (room.host_id !== hostId) {
      throw new Error("Only the room host may start the room");
    }

    return await RoomRepository.updateStatus(
      roomCode,
      ROOM_STATUS.ACTIVE
    );
  }

  async finishRoom(roomCode, hostId) {
    const room = await RoomRepository.getRoomByCode(roomCode);
    if (!room) throw new Error("Room not found");
    if (room.host_id !== hostId) {
      throw new Error("Only the room host may finish the room");
    }

    return await RoomRepository.updateStatus(
      roomCode,
      ROOM_STATUS.FINISHED
    );
  }

  async getRoomsByHost(hostId) {
    if (!hostId) throw new Error("Host authentication required");
    const rooms = await RoomRepository.getRoomsByHost(hostId);
    return rooms;
  }

  // 🧾 GET ROOM DATA
  async getRoom(roomCode) {
    const room = await RoomRepository.getRoomByCode(roomCode);
    if (!room) throw new Error("Room not found");

    const players = await RoomRepository.getPlayers(room.id);

    return {
      room,
      players
    };
  }

  async generateUniqueRoomCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const roomCode = RoomUtils.generateRoomCode();
      const existingRoom = await RoomRepository.getRoomByCode(roomCode);
      if (!existingRoom) return roomCode;
    }

    throw new Error("Could not generate a unique room code");
  }
}

module.exports = new RoomService();
