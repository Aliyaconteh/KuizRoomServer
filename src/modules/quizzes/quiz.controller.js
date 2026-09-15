const QuizService = require("./quiz.service");

class QuizController {
  async create(req, res) {
    try {
      const { title, description } = req.body;
      const hostId = req.user?.id;

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Quiz title is required"
        });
      }

      const quiz = await QuizService.createQuiz({
        title,
        description,
        created_by: hostId
      });

      return res.status(201).json({
        success: true,
        data: quiz
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async addQuestion(req, res) {
    try {
      const hostId = req.user?.id;
      const quiz_id = req.body.quiz_id || req.body.quizId;
      const question = req.body.question || req.body.question_text || req.body.questionText;
      const options = req.body.options || [
        req.body.option_a,
        req.body.option_b,
        req.body.option_c,
        req.body.option_d
      ].filter(Boolean);
      const correct_answer = req.body.correct_answer || req.body.correctAnswer || req.body.correct_option || req.body.correctOption;
      const time_limit = req.body.time_limit || req.body.timeLimit;

      if (!quiz_id || !question || !options || !correct_answer) {
        return res.status(400).json({
          success: false,
          message: "quiz_id, question, options, and correct_answer are required",
          acceptedFields: {
            quiz: ["quiz_id", "quizId"],
            question: ["question", "question_text", "questionText"],
            options: ["options array", "option_a, option_b, option_c, option_d"],
            correctAnswer: ["correct_answer", "correctAnswer", "correct_option", "correctOption"]
          }
        });
      }

      const savedQuestion = await QuizService.addQuestion({
        quiz_id,
        question,
        options,
        correct_answer,
        time_limit
      }, hostId);

      return res.status(201).json({
        success: true,
        data: savedQuestion
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async update(req, res) {
    try {
      const quiz = await QuizService.updateQuiz(req.params.id, req.body, req.user?.id);

      return res.json({
        success: true,
        data: quiz
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async remove(req, res) {
    try {
      const quiz = await QuizService.deleteQuiz(req.params.id, req.user?.id);

      return res.json({
        success: true,
        data: quiz
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async updateQuestion(req, res) {
    try {
      const question = await QuizService.updateQuestion(req.params.id, req.body, req.user?.id);

      return res.json({
        success: true,
        data: question
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async deleteQuestion(req, res) {
    try {
      const question = await QuizService.deleteQuestion(req.params.id, req.user?.id);

      return res.json({
        success: true,
        data: question
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
  }

  async getQuiz(req, res) {
    try {
      const quiz = await QuizService.getQuiz(req.params.id, req.user?.id);

      return res.json({
        success: true,
        data: quiz
      });
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
  }

  async getAll(req, res) {
    try {
      const quizzes = await QuizService.getAllQuizzes(req.user?.id);

      return res.json({
        success: true,
        data: quizzes
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
  }
}

module.exports = new QuizController();
