const { supabaseAdmin } = require("../../config/supabase.config");

class QuizRepository {

  // 📌 CREATE QUIZ
  async createQuiz(data) {
    const { data: quiz, error } = await supabaseAdmin
      .from("quizzes")
      .insert([data])
      .select()
      .single();

    if (error) throw error;
    return quiz;
  }

  async updateQuiz(id, updates) {
    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteQuiz(id) {
    // Remove any answers that reference questions belonging to this quiz
    const { data: questions, error: qErr } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("quiz_id", id);

    if (qErr) throw qErr;

    const questionIds = Array.isArray(questions) ? questions.map((q) => q.id) : [];

    if (questionIds.length > 0) {
      const { error: aErr } = await supabaseAdmin
        .from("answers")
        .delete()
        .in("question_id", questionIds);

      if (aErr) throw aErr;
    }

    const { error } = await supabaseAdmin
      .from("quizzes")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { id };
  }

  // 📌 ADD QUESTION
  async addQuestion(question) {
    const { data, error } = await supabaseAdmin
      .from("questions")
      .insert([question])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getQuestionById(questionId) {
    const { data, error } = await supabaseAdmin
      .from("questions")
      .select("*")
      .eq("id", questionId)
      .single();

    if (error) throw error;
    return data;
  }

  async updateQuestion(id, updates) {
    const { data, error } = await supabaseAdmin
      .from("questions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteQuestion(id) {
    const { error } = await supabaseAdmin
      .from("questions")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { id };
  }

  // 📌 GET QUIZ WITH QUESTIONS (IMPORTANT FOR GAME ENGINE)
  async getQuizWithQuestions(quizId) {
    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .select(`
        *,
        questions (*)
      `)
      .eq("id", quizId)
      .single();

    if (error) throw error;
    return data;
  }

  async getQuizById(quizId) {
    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .select("*")
      .eq("id", quizId)
      .single();

    if (error) throw error;
    return data;
  }

  async getAllByOwner(hostId) {
    const { data, error } = await supabaseAdmin
      .from("quizzes")
      .select(`
        id,
        title,
        description,
        created_by,
        created_at,
        questions(id)
      `)
      .eq("created_by", hostId);

    if (error) throw error;
    return data.map((quiz) => ({
      ...quiz,
      question_count: quiz.questions ? quiz.questions.length : 0
    }));
  }
}

module.exports = new QuizRepository();
