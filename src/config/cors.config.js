const configuredOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_ORIGINS || "").split(",")
]
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => new URL(origin).origin);

if (process.env.NODE_ENV === "production" && !process.env.CLIENT_URL) {
  throw new Error("CLIENT_URL is required in production");
}

const corsOrigin = (origin, callback) => {
  if (!origin || configuredOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error("Origin not allowed by CORS"));
};

module.exports = { corsOrigin };
