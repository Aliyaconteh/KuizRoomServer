const AuthService = require("./auth.service");

class AuthController {
  async signup(req, res) {
    try {
      const { email, password, username } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({
          success: false,
          errorType: "VALIDATION_ERROR",
          source: "Auth Controller",
          message: "Email, password, and username are required",
          hint: "Please provide all required fields (email, password, username)."
        });
      }

      const data = await AuthService.signup(email, password, username);

      return res.status(201).json({
        success: true,
        data
      });
    } catch (err) {
      console.error("[AUTH_SIGNUP] [ERROR]", err.message);
      const isValidation = err.message.includes("already registered") || err.message.includes("required");
      return res.status(isValidation ? 400 : 500).json({
        success: false,
        errorType: isValidation ? "VALIDATION_ERROR" : "SERVER_ERROR",
        source: "Auth Service",
        message: err.message,
        hint: isValidation ? "Try signing in or using a different email address." : "Please check database configuration.",
        cause: err.cause?.message
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          errorType: "VALIDATION_ERROR",
          source: "Auth Controller",
          message: "Email and password are required",
          hint: "Please enter both your email address and password."
        });
      }

      const data = await AuthService.login(email, password);

      return res.json({
        success: true,
        data
      });
    } catch (err) {
      console.error("[AUTH_LOGIN] [ERROR]", err.message);
      const isAuthError = err.message.includes("Invalid email or password");
      return res.status(isAuthError ? 401 : 500).json({
        success: false,
        errorType: isAuthError ? "AUTH_ERROR" : "SERVER_ERROR",
        source: "Auth Service",
        message: err.message,
        hint: isAuthError ? "Please check your email and password and try again." : "Internal server or database error.",
        cause: err.cause?.message
      });
    }
  }

  async googleLogin(req, res) {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          errorType: "VALIDATION_ERROR",
          source: "Auth Controller",
          message: "Google access token is required"
        });
      }

      const data = await AuthService.loginWithGoogle(accessToken);

      return res.json({
        success: true,
        data
      });
    } catch (err) {
      console.error("[GOOGLE_AUTH] [ERROR]", err.message);
      return res.status(401).json({
        success: false,
        errorType: "AUTH_ERROR",
        source: "Google Auth Service",
        message: err.message,
        cause: err.cause?.message
      });
    }
  }

  async me(req, res) {
    try {
      return res.json({
        success: true,
        data: req.user
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const { username } = req.body;
      const data = await AuthService.updateProfile(req.user.id, username);
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const data = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async getStats(req, res) {
    try {
      const userId = req.user?.id;
      const username = req.user?.username;

      const { supabaseAdmin } = require("../../config/supabase.config");

      // Count created quizzes
      const { count: quizCount, error: quizError } = await supabaseAdmin
        .from("quizzes")
        .select("id", { count: "exact", head: true })
        .eq("created_by", userId);
      if (quizError) throw quizError;

      // Fetch player sessions
      const { data: sessionRows, error: sessionError } = await supabaseAdmin
        .from("session_results")
        .select("id, room_id, score, rank, created_at, rooms(room_code, room_name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (sessionError) throw sessionError;

      const gamesPlayed = sessionRows ? sessionRows.length : 0;
      const wins = sessionRows ? sessionRows.filter((r) => r.rank === 1).length : 0;
      const podiums = sessionRows ? sessionRows.filter((r) => r.rank >= 1 && r.rank <= 3).length : 0;
      const totalPoints = sessionRows ? sessionRows.reduce((sum, r) => sum + Number(r.score || 0), 0) : 0;
      const avgScore = gamesPlayed ? Math.round(totalPoints / gamesPlayed) : 0;

      const history = (sessionRows || []).slice(0, 20).map((row) => ({
        id: row.id,
        roomCode: row.rooms?.room_code || "N/A",
        roomName: row.rooms?.room_name || "Multiplayer Session",
        score: Number(row.score || 0),
        rank: row.rank || "-",
        playedAt: row.created_at
      }));

      return res.json({
        success: true,
        data: {
          gamesPlayed,
          quizzesCreated: quizCount || 0,
          wins,
          podiums,
          totalPoints,
          avgScore,
          history
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new AuthController();
