import type { AttemptResult, MockExamSummary, ReviewQuestion } from "@/lib/types";
import type { createClient } from "@/lib/supabase/server";
import {
  compareChapterLabels,
  detectImportTypeFromTitle,
  getImportPrefix,
  inferChapterLabel,
  stripChapterFromTopic,
  stripImportPrefix,
  stripUploadSuffix
} from "@/lib/review-content";
import { fetchAllRows, fetchAllRowsForIds } from "@/lib/supabase/pagination";
import type { ImportType } from "@/lib/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

function mapQuestionRow(row: any): ReviewQuestion {
  return {
    id: row.id,
    mock_exam_id: row.mock_exam_id,
    question_text: row.question_text,
    explanation: row.explanation,
    difficulty: row.difficulty,
    subject: row.subjects?.name ?? "Unassigned Subject",
    topic: row.topics?.name ?? "Unassigned Topic",
    choices: (row.exam_choices ?? [])
      .map((choice: any) => ({
        choice_key: choice.choice_key,
        choice_text: choice.choice_text,
        is_correct: choice.is_correct
      }))
      .sort((a: any, b: any) => a.choice_key.localeCompare(b.choice_key))
  };
}

export async function getMockExamSummaries(
  supabase: ServerClient,
  contentType: ImportType = "exam"
): Promise<MockExamSummary[]> {
  // Filter by the import prefix in the database instead of pulling every exam back
  // and discarding most of them client-side.
  const exams = await fetchAllRows<any>((from, to) =>
    supabase
      .from("mock_exams")
      .select("id, title, subjects(name)")
      .ilike("title", `${getImportPrefix(contentType)}%`)
      .order("created_at", { ascending: false })
      .range(from, to)
  );

  const matchingExams = exams.filter((exam: any) => detectImportTypeFromTitle(exam.title ?? "") === contentType);

  // Questions are fetched separately and paginated. Embedding them in the exam
  // select returns one enormous payload and hides how many rows came back.
  const questions = await fetchAllRowsForIds<any, string>(
    matchingExams.map((exam: any) => exam.id),
    (examIds, from, to) =>
      supabase
        .from("exam_questions")
        .select("id, mock_exam_id, topic_id, topics(name)")
        .in("mock_exam_id", examIds)
        .order("id", { ascending: true })
        .range(from, to)
  );

  const questionsByExamId = new Map<string, any[]>();
  questions.forEach((question: any) => {
    const current = questionsByExamId.get(question.mock_exam_id) ?? [];
    current.push(question);
    questionsByExamId.set(question.mock_exam_id, current);
  });

  const rawSummaries = matchingExams
    .flatMap<MockExamSummary>((exam: any) => {
      const normalizedTitle = stripUploadSuffix(stripImportPrefix(exam.title ?? ""));
      const subject = exam.subjects?.name ?? "Unassigned Subject";
      const chapterGroups = new Map<
        string,
        { topicId: string | null; topicName: string }[]
      >();

      (questionsByExamId.get(exam.id) ?? []).forEach((question: any) => {
        const topicName = question.topics?.name ?? "General";
        const chapterLabel = inferChapterLabel(topicName) ?? inferChapterLabel(normalizedTitle) ?? "Chapter 1";
        const current = chapterGroups.get(chapterLabel) ?? [];
        current.push({
          topicId: question.topic_id ?? null,
          topicName
        });
        chapterGroups.set(chapterLabel, current);
      });

      if (chapterGroups.size === 0) {
        return [
          {
            id: exam.id,
            sourceExamId: exam.id,
            title: normalizedTitle,
            subject,
            chapter: inferChapterLabel(normalizedTitle) ?? null,
            topics: [],
            questionCount: 0,
            topicCount: 0
          }
        ];
      }

      return Array.from(chapterGroups.entries())
        .sort(([leftChapter], [rightChapter]) => compareChapterLabels(leftChapter, rightChapter))
        .map(([chapterLabel, entries]) => ({
          id: `${exam.id}::${chapterLabel}`,
          sourceExamId: exam.id,
          title: normalizedTitle,
          subject,
          chapter: chapterLabel,
          topics: Array.from(new Set(entries.map((entry) => stripChapterFromTopic(entry.topicName)))).sort((left, right) =>
            left.localeCompare(right, undefined, { sensitivity: "base", numeric: true })
          ),
          questionCount: entries.length,
          topicCount: new Set(entries.map((entry) => entry.topicId).filter(Boolean)).size
        }));
    });

  const dedupedSummaries: MockExamSummary[] = [];
  const seen = new Set<string>();

  for (const summary of rawSummaries) {
    const dedupeKey = [
      summary.subject.trim().toLowerCase(),
      summary.title.trim().toLowerCase(),
      (summary.chapter ?? "").trim().toLowerCase(),
      [...summary.topics].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base", numeric: true })).join("|")
    ].join("::");

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    dedupedSummaries.push(summary);
  }

  return dedupedSummaries;
}

export async function getQuestionBankRows(
  supabase: ServerClient,
  contentType?: ImportType
): Promise<ReviewQuestion[]> {
  const baseColumns =
    "id, mock_exam_id, question_text, explanation, difficulty, subjects(name), topics(name), exam_choices(choice_key, choice_text, is_correct)";

  const fetchUnfiltered = () =>
    fetchAllRows<any>((from, to) =>
      supabase
        .from("exam_questions")
        .select(`${baseColumns}, mock_exams(title)`)
        .order("created_at", { ascending: false })
        .range(from, to)
    );

  let rows: any[];

  if (contentType) {
    // Push the content-type filter into the database. Filtering only after the
    // fetch meant flashcards came back empty whenever the newest 1000 questions
    // happened to all be exam or quiz imports.
    try {
      rows = await fetchAllRows<any>((from, to) =>
        supabase
          .from("exam_questions")
          .select(`${baseColumns}, mock_exams!inner(title)`)
          .ilike("mock_exams.title", `${getImportPrefix(contentType)}%`)
          .order("created_at", { ascending: false })
          .range(from, to)
      );
    } catch (error) {
      // Fall back to filtering in memory if the embedded filter is rejected.
      // Slower, but the paginated fetch still returns the complete question bank.
      console.error("Embedded content-type filter failed, falling back to a full scan:", error);
      rows = await fetchUnfiltered();
    }
  } else {
    rows = await fetchUnfiltered();
  }

  return rows
    .filter((row: any) => !contentType || detectImportTypeFromTitle(row.mock_exams?.title ?? "") === contentType)
    .map(mapQuestionRow);
}

export async function getMockExamQuestions(supabase: ServerClient, examId: string): Promise<ReviewQuestion[]> {
  const rows = await fetchAllRows<any>((from, to) =>
    supabase
      .from("exam_questions")
      .select(
        "id, mock_exam_id, question_text, explanation, difficulty, subjects(name), topics(name), exam_choices(choice_key, choice_text, is_correct)"
      )
      .eq("mock_exam_id", examId)
      .order("created_at", { ascending: true })
      .range(from, to)
  );

  return rows.map(mapQuestionRow);
}

export async function getWeakTopicNamesForStudent(supabase: ServerClient, studentId: string): Promise<string[]> {
  const { data: attempts, error: attemptsError } = await supabase
    .from("exam_attempts")
    .select("id")
    .eq("student_id", studentId)
    .not("submitted_at", "is", null);

  if (attemptsError || !attempts || attempts.length === 0) {
    return [];
  }

  const attemptIds = attempts.map((attempt: any) => attempt.id);
  const answers = await fetchAllRowsForIds<any, string>(attemptIds, (idChunk, from, to) =>
    supabase
      .from("exam_answers")
      .select("is_correct, exam_questions(topics(name))")
      .in("attempt_id", idChunk)
      .order("id", { ascending: true })
      .range(from, to)
  );

  const topicStats = new Map<string, { correct: number; total: number }>();
  answers.forEach((answer: any) => {
    const topicName = answer.exam_questions?.topics?.name;
    if (!topicName) return;
    const current = topicStats.get(topicName) ?? { correct: 0, total: 0 };
    current.total += 1;
    if (answer.is_correct) current.correct += 1;
    topicStats.set(topicName, current);
  });

  return Array.from(topicStats.entries())
    .map(([topic, stats]) => ({ topic, accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4)
    .map((item) => item.topic);
}

export async function submitMockExamAttempt({
  supabase,
  studentId,
  mockExamId,
  answers
}: {
  supabase: ServerClient;
  studentId: string;
  mockExamId: string;
  answers: { questionId: string; selectedChoice: "A" | "B" | "C" | "D" }[];
}) {
  const submittedQuestionIds = answers.map((answer) => answer.questionId);

  // Only score questions that actually belong to this exam, so a tampered payload
  // cannot inject question ids from another set.
  const { data: examQuestions, error: examQuestionsError } = await supabase
    .from("exam_questions")
    .select("id")
    .eq("mock_exam_id", mockExamId)
    .in("id", submittedQuestionIds);

  if (examQuestionsError) throw examQuestionsError;

  const validQuestionIds = new Set((examQuestions ?? []).map((question: any) => question.id));
  const validAnswers = answers.filter((answer) => validQuestionIds.has(answer.questionId));

  if (validAnswers.length === 0) {
    throw new Error("None of the submitted answers belong to this exam.");
  }

  const questionIds = validAnswers.map((answer) => answer.questionId);
  const { data: correctChoices, error: correctChoicesError } = await supabase
    .from("exam_choices")
    .select("question_id, choice_key")
    .in("question_id", questionIds)
    .eq("is_correct", true);

  if (correctChoicesError) throw correctChoicesError;

  const correctMap = new Map<string, string>();
  (correctChoices ?? []).forEach((choice: any) => {
    correctMap.set(choice.question_id, choice.choice_key);
  });

  const answerRows = validAnswers.map((answer) => ({
    question_id: answer.questionId,
    selected_choice: answer.selectedChoice,
    is_correct: correctMap.get(answer.questionId) === answer.selectedChoice
  }));

  const correctCount = answerRows.filter((answer) => answer.is_correct).length;
  const totalItems = answerRows.length;
  const score = totalItems > 0 ? Math.round((correctCount / totalItems) * 10000) / 100 : 0;

  const { data: attempt, error: attemptError } = await supabase
    .from("exam_attempts")
    .insert({
      student_id: studentId,
      mock_exam_id: mockExamId,
      score,
      total_items: totalItems,
      correct_count: correctCount,
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (attemptError || !attempt) throw attemptError ?? new Error("Failed to create exam attempt.");

  const { error: answersError } = await supabase.from("exam_answers").insert(
    answerRows.map((answer) => ({
      attempt_id: attempt.id,
      question_id: answer.question_id,
      selected_choice: answer.selected_choice,
      is_correct: answer.is_correct
    }))
  );

  if (answersError) throw answersError;
  return attempt.id as string;
}

export async function getAttemptResult(
  supabase: ServerClient,
  attemptId: string,
  studentId: string
): Promise<AttemptResult | null> {
  const { data: attempt, error: attemptError } = await supabase
    .from("exam_attempts")
    .select("id, score, total_items, correct_count")
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (attemptError) throw attemptError;
  if (!attempt) return null;

  const { data: answers, error: answersError } = await supabase
    .from("exam_answers")
    .select(
      "selected_choice, is_correct, exam_questions(id, question_text, explanation, subjects(name), topics(name), exam_choices(choice_key, choice_text, is_correct))"
    )
    .eq("attempt_id", attemptId);

  if (answersError) throw answersError;

  const items = (answers ?? []).map((answer: any) => {
    const question = answer.exam_questions;
    const choices = (question?.exam_choices ?? [])
      .map((choice: any) => ({
        choice_key: choice.choice_key,
        choice_text: choice.choice_text,
        is_correct: choice.is_correct
      }))
      .sort((a: any, b: any) => a.choice_key.localeCompare(b.choice_key));

    const correctChoice = choices.find((choice: any) => choice.is_correct)?.choice_key ?? "A";

    return {
      questionId: question?.id ?? "",
      questionText: question?.question_text ?? "",
      explanation: question?.explanation ?? "",
      topic: question?.topics?.name ?? "Unassigned Topic",
      subject: question?.subjects?.name ?? "Unassigned Subject",
      selectedChoice: answer.selected_choice,
      correctChoice,
      isCorrect: answer.is_correct,
      choices
    };
  });

  const weakTopics = Array.from(new Set(items.filter((item) => !item.isCorrect).map((item) => item.topic)));

  return {
    id: attempt.id,
    score: Number(attempt.score ?? 0),
    totalItems: attempt.total_items ?? items.length,
    correctCount: attempt.correct_count ?? items.filter((item) => item.isCorrect).length,
    weakTopics,
    items
  };
}
