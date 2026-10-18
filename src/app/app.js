const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { corsOrigin } = require("../config/cors.config");
const authRoutes = require("../modules/auth/auth.routes");
const quizRoutes = require("../modules/quizzes/quiz.routes");
const aiRoutes = require("../modules/ai/ai.routes");
const roomRoutes = require("../modules/rooms/room.routes");
const leaderboardRoutes = require("../modules/leaderboard/leaderboard.routes");
const syncRoutes = require("../modules/sync/sync.routes");

const app = express();

const trustProxyHops = process.env.TRUST_PROXY_HOPS === undefined
  ? 0
  : Number(process.env.TRUST_PROXY_HOPS);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
  throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 10");
}
app.set("trust proxy", trustProxyHops);

// Security middleware
app.use(helmet());

// Logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// CORS setup
const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health",
  message: { success: false, message: "Too many requests. Please try again later." }
});
app.use(apiRateLimit);

// Body parser
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb", parameterLimit: 100 }));

app.use("/auth", authRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/sync", syncRoutes);

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "KuizRoom API is running"
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500
    ? err.status
    : 500;
  if (status === 500) {
    console.error("[HTTP_ERROR]", err);
  }

  return res.status(status).json({
    success: false,
    message: status === 413 ? "Request body is too large." : status === 500
      ? "Internal server error."
      : "Invalid request."
  });
});

module.exports = app;
