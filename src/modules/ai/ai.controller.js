const fs = require("fs/promises");
const AIService = require("./ai.service");
const { extractTextFromFile } = require("../../utils/fileExtractor");

class AIController {
  async generateQuiz(req, res) {
    const document = req.file;
    try {
      const hostId = req.user?.id;
      const { numberOfQuestions, difficulty, topic } = req.body;
      const normalizedTopic = typeof topic === "string" ? topic.trim() : "";

      if (!document && !normalizedTopic) {
        return res.status(400).json({ success: false, message: "Upload a document or provide a topic." });
      }

      const parsedNumber = Number(numberOfQuestions);
      if (!parsedNumber || parsedNumber < 1 || parsedNumber > 50) {
        return res.status(400).json({ success: false, message: "Number of questions must be between 1 and 50." });
      }

      const quiz = document
        ? await AIService.generateQuizFromDocument({
            hostId,
            documentPath: document.path,
            documentName: document.originalname,
            numberOfQuestions: parsedNumber,
            difficulty: difficulty || "Mixed"
          })
        : await AIService.generateQuizFromTopic({
            hostId,
            topic: normalizedTopic,
            numberOfQuestions: parsedNumber,
            difficulty: difficulty || "Mixed"
          });

      console.log(`[AI] quiz generation completed for host=${hostId}`);
      return res.status(201).json({ success: true, data: quiz });
    } catch (err) {
      console.error("[AI] generation error:", err.message);
      return res.status(400).json({ success: false, message: err.message });
    } finally {
      if (document && document.path) {
        await fs.unlink(document.path).catch(() => {});
      }
    }
  }

  async chat(req, res) {
    const document = req.file;
    try {
      const hostId = req.user?.id;
      const { message } = req.body;
      let history = req.body.history || [];
      if (typeof history === "string") {
        try {
          history = JSON.parse(history);
        } catch {
          return res.status(400).json({ success: false, message: "Chat history must be valid JSON." });
        }
      }

      const documentText = document
        ? await extractTextFromFile(document.path, document.originalname)
        : "";
      if (document && !documentText.trim()) {
        return res.status(400).json({ success: false, message: "The uploaded file contains no readable text." });
      }

      const response = await AIService.chatWithTutor({
        hostId,
        message,
        history,
        documentText,
        documentName: document?.originalname
      });

      return res.status(200).json({ success: true, data: response });
    } catch (err) {
      console.error("[AI] chat error:", err.message);
      return res.status(400).json({ success: false, message: err.message });
    } finally {
      if (document?.path) {
        await fs.unlink(document.path).catch((err) => {
          console.error("[AI] failed to remove uploaded chat document:", err.message);
        });
      }
    }
  }
}

module.exports = new AIController();
