const { supabaseAdmin } = require("../../config/supabase.config");
const RoomRepository = require("../rooms/room.repository");

class SyncEngine {
  constructor(io) {
    this.io = io;
    this.tempState = new Map();
  }

  optimisticUpdate({ roomCode, playerId, tempScore }) {
    if (!this.tempState.has(roomCode)) {
      this.tempState.set(roomCode, new Map());
    }

    const room = this.tempState.get(roomCode);
    room.set(playerId, tempScore);

    this.io.to(roomCode).emit("optimistic-update", {
      playerId,
      score: tempScore
    });
  }

  async serverValidate({
    roomCode,
    playerId,
    questionId,
    answer,
    responseStart = Date.now(),
    responseEnd = Date.now()
  }) {
    const room = await RoomRepository.getRoomByCode(roomCode);
    if (!room) throw new Error("Room not found");
    if (room.status !== "active") throw new Error("Room is not active");
    if (!playerId || !questionId || typeof answer !== "string") {
      throw new Error("Player, question, and answer are required");
    }

    const { data: player, error: playerError } = await supabaseAdmin
      .from("room_players")
      .select("id")
      .eq("id", playerId)
      .eq("room_id", room.id)
      .maybeSingle();
    if (playerError) throw playerError;
    if (!player) throw new Error("Player is not registered in this room");

    const { data: question, error: questionError } = await supabaseAdmin
      .from("questions")
      .select("id, correct_answer")
      .eq("id", questionId)
      .eq("quiz_id", room.quiz_id)
      .maybeSingle();
    if (questionError) throw questionError;
    if (!question) throw new Error("Question does not belong to this room");

    const suppliedStart = Number(responseStart);
    const safeResponseStart = Number.isFinite(suppliedStart) &&
      suppliedStart <= responseEnd &&
      suppliedStart >= responseEnd - 60 * 60 * 1000
      ? suppliedStart
      : responseEnd;
    const latency = Math.max(0, responseEnd - safeResponseStart);
    const isCorrect = question.correct_answer === answer;
    const serverScore = isCorrect ? 10 : 0;

    const { error: logError } = await supabaseAdmin.from("sync_logs").insert([{
      room_id: room.id,
      player_id: player.id,
      user_id: null,
      sync_mode: "server",
      event_type: "confirm-answer",
      client_timestamp: safeResponseStart,
      server_timestamp: responseEnd,
      latency,
      server_score: serverScore
    }]);
    if (logError) throw logError;

    this.io.to(roomCode).emit("server-confirmation", {
      playerId,
      correct: isCorrect,
      serverScore
    });

    return serverScore;
  }

  async reconcile(roomCode) {
    const roomRecord = await RoomRepository.getRoomByCode(roomCode);
    if (!roomRecord) throw new Error("Room not found");

    const { data: players, error } = await supabaseAdmin
      .from("room_players")
      .select("id, score")
      .eq("room_id", roomRecord.id);
    if (error) throw error;

    const optimistic = this.tempState.get(roomCode) || new Map();

    const results = (players || []).map((player) => {
      const serverScore = Number(player.score || 0);
      const optimisticScore = optimistic.get(player.id) || 0;

      return {
        playerId: player.id,
        serverScore,
        optimisticScore,
        difference: optimisticScore - serverScore
      };
    });

    this.io.to(roomCode).emit("sync-reconciliation", {
      results
    });

    this.tempState.delete(roomCode);

    return results;
  }
}

module.exports = SyncEngine;
