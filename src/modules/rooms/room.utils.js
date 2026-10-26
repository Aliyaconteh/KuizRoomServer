const crypto = require("crypto");

class RoomUtils {

  // Generate an unpredictable six-character room code.
  static generateRoomCode() {
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array.from(
      { length: 6 },
      () => alphabet[crypto.randomInt(alphabet.length)]
    ).join("");
  }

  // 👤 Format player object
  static formatPlayer(user) {
    return {
      id: user.id,
      username: user.username || "Anonymous",
      joinedAt: new Date()
    };
  }

  // 📊 Calculate player count
  static getPlayerCount(players = []) {
    return players.length;
  }

  // 🎯 Validate room code
  static isValidRoomCode(code) {
    return typeof code === "string" && /^[A-Z0-9]{6}$/.test(code);
  }

  static resolveDelay(level = "low", customMs) {
    const presets = {
      low: 0,
      medium: 50,
      high: 100,
      custom: 200
    };

    if (level === "custom" && customMs != null) {
      const ms = Number(customMs);
      if (!Number.isInteger(ms) || ms < 0 || ms > 5000) {
        throw new Error("Custom delay must be an integer between 0 and 5000ms");
      }
      return { level, ms };
    }

    if (!Object.prototype.hasOwnProperty.call(presets, level)) {
      throw new Error("delayLevel must be low, medium, high, or custom");
    }

    return { level, ms: presets[level] };
  }
}

module.exports = RoomUtils;
