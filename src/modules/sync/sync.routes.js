const express = require("express");
const SyncController = require("./sync.controller");
const authenticatedMiddleware = require("../../middlewares/authenticated.middleware");

const router = express.Router();

router.use(authenticatedMiddleware);
router.get("/overview", (req, res) => SyncController.getOverview(req, res));
router.get("/export", (req, res) => SyncController.exportLogs(req, res));
router.get("/export/:roomCode", (req, res) => SyncController.exportLogs(req, res));
router.get("/:roomCode/logs", (req, res) => SyncController.getLogs(req, res));
router.get("/:roomCode/summary", (req, res) => SyncController.getSummary(req, res));

module.exports = router;
