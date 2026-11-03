const AuthService = require("../modules/auth/auth.service");

const authenticatedMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const user = await AuthService.getUser(token);
    if (!user || !["host", "researcher"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Analysis access required" });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || "Unauthorized" });
  }
};

module.exports = authenticatedMiddleware;
