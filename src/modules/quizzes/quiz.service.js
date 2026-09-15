const QuizRepository = require("./quiz.repository");

class QuizService {

  async createQuiz({ title, description, created_by }) {
    if (!title) throw new Error("Quiz title is required");
    if (!created_by) throw new Error("Host authentication is required");

    return await QuizRepository.createQuiz({
      title,
      description: description ? String(description).trim() : null,
      created_by
    });
  }

  async updateQuiz(id, updates, hostId) {
    if (!id) throw new Error("Quiz ID is required");
    await this.ensureQuizOwner(id, hostId);
    return await QuizRepository.updateQuiz(id, updates);
  }

  async deleteQuiz(id, hostId) {
    if (!id) throw new Error("Quiz ID is required");
    await this.ensureQuizOwner(id, hostId);
    return await QuizRepository.deleteQuiz(id);
  }

  async addQuestion(question, hostId) {
    await this.ensureQuizOwner(question.quiz_id, hostId);
    const sanitizedQuestion = this.sanitizeQuestion(question);
    this.validateQuestion(sanitizedQuestion);
    return await QuizRepository.addQuestion(sanitizedQuestion);
  }

  async updateQuestion(id, updates, hostId) {
    if (!id) throw new Error("Question ID is required");
    const question = await QuizRepository.getQuestionById(id);
    if (!question) throw new Error("Question not found");
    await this.ensureQuizOwner(question.quiz_id, hostId);
    return await QuizRepository.updateQuestion(id, updates);
  }

  async deleteQuestion(id, hostId) {
    if (!id) throw new Error("Question ID is required");
    const question = await QuizRepository.getQuestionById(id);
    if (!question) throw new Error("Question not found");
    await this.ensureQuizOwner(question.quiz_id, hostId);
    return await QuizRepository.deleteQuestion(id);
  }

  async getQuiz(id, hostId) {
    await this.ensureQuizOwner(id, hostId);
    return await QuizRepository.getQuizWithQuestions(id);
  }

  async getAllQuizzes(hostId) {
    return await QuizRepository.getAllByOwner(hostId);
  }

  async ensureQuizOwner(quizId, hostId) {
    if (!hostId) throw new Error("Host authorization required");
    const quiz = await QuizRepository.getQuizById(quizId);
    if (!quiz) throw new Error("Quiz not found");
    if (quiz.created_by !== hostId) {
      throw new Error("You do not have permission to access this quiz");
    }
    return quiz;
  }

  validateQuestion(question) {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error("Question options must contain at least two choices");
    }

    if (!question.options.includes(question.correct_answer)) {
      throw new Error("correct_answer must match one of the provided options");
    }

    if (question.time_limit && Number(question.time_limit) < 5) {
      throw new Error("time_limit must be at least 5 seconds");
    }
  }

  sanitizeQuestion(question) {
    return {
      ...question,
      question: typeof question.question === "string" ? question.question.trim() : question.question,
      options: Array.isArray(question.options)
        ? question.options.map((option) => (typeof option === "string" ? option.trim() : option))
        : question.options,
      correct_answer:
        typeof question.correct_answer === "string" ? question.correct_answer.trim() : question.correct_answer
    };
  }
}

module.exports = new QuizService();
