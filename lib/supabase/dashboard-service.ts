import { createClient } from "./client";
import { inferChapterLabel, stripChapterFromTopic } from "@/lib/review-content";
import { fetchAllRows, fetchAllRowsForIds } from "@/lib/supabase/pagination";

type SupabaseClient = ReturnType<typeof createClient>;

export interface StudentStats {
  totalExams: number;
  averageScore: number;
  studyStreak: number;
  totalTime: number;
}

export interface PerformanceData {
  subject: string;
  score: number;
}

export interface WeakTopic {
  topic: string;
  accuracy: number;
}

export interface RecentExam {
  id: string;
  title: string;
  score: number;
  date: string;
}

export interface ReadinessData {
  score: number;
  weakAreas: string[];
}

export interface StudentStudyOverview {
  availableExams: number;
  availableReviewers: number;
  recommendedFocus: string;
}

export interface SubjectSummary {
  name: string;
  examCount: number;
}

export interface SubjectDashboardGraphPoint {
  subject: string;
  totalChapters: number;
  chaptersTaken: number;
  chaptersLeft: number;
  weakTopics: number;
}

export class DashboardService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient();
  }

  async getStudentStats(studentId: string): Promise<StudentStats> {
    try {
      const { data: attempts, error } = await this.client
        .from("exam_attempts")
        .select("score")
        .eq("student_id", studentId)
        .not("submitted_at", "is", null);

      if (error) throw error;

      const totalExams = attempts?.length || 0;
      const averageScore = attempts?.length
        ? attempts.reduce((sum, attempt) => sum + (Number(attempt.score) || 0), 0) / attempts.length
        : 0;

      const studyStreak = await this.calculateStudyStreak(studentId);
      const totalTime = totalExams * 45;

      return {
        totalExams,
        averageScore: Math.round(averageScore * 100) / 100,
        studyStreak,
        totalTime
      };
    } catch (error) {
      console.error("Error fetching student stats:", error);
      throw error;
    }
  }

  async getPerformanceData(studentId: string): Promise<PerformanceData[]> {
    try {
      const { data, error } = await this.client
        .from("exam_attempts")
        .select("score, mock_exams(subjects(name))")
        .eq("student_id", studentId)
        .not("submitted_at", "is", null);

      if (error) throw error;

      const subjectScores: { [key: string]: number[] } = {};

      data?.forEach((attempt: any) => {
        const subjectName = attempt.mock_exams?.subjects?.name;
        if (subjectName) {
          if (!subjectScores[subjectName]) {
            subjectScores[subjectName] = [];
          }
          // A null score would poison the average and render the bar as NaN.
          subjectScores[subjectName].push(Number(attempt.score) || 0);
        }
      });

      return Object.entries(subjectScores).map(([subject, scores]) => ({
        subject,
        score: Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100
      }));
    } catch (error) {
      console.error("Error fetching performance data:", error);
      throw error;
    }
  }

  async getWeakTopics(studentId: string): Promise<WeakTopic[]> {
    try {
      const { data: attempts, error: attemptsError } = await this.client
        .from("exam_attempts")
        .select("id")
        .eq("student_id", studentId)
        .not("submitted_at", "is", null);

      if (attemptsError) throw attemptsError;

      if (!attempts || attempts.length === 0) {
        return [];
      }

      const attemptIds = attempts.map((a) => a.id);

      const data = await fetchAllRowsForIds<any, string>(attemptIds, (idChunk, from, to) =>
        this.client
          .from("exam_answers")
          .select("is_correct, exam_questions(topics(name))")
          .in("attempt_id", idChunk)
          .order("id", { ascending: true })
          .range(from, to)
      );

      const topicStats: { [key: string]: { correct: number; total: number } } = {};

      data.forEach((answer: any) => {
        const topicName = answer.exam_questions?.topics?.name;
        if (topicName) {
          if (!topicStats[topicName]) {
            topicStats[topicName] = { correct: 0, total: 0 };
          }
          topicStats[topicName].total++;
          if (answer.is_correct) {
            topicStats[topicName].correct++;
          }
        }
      });

      return Object.entries(topicStats)
        .map(([topic, stats]) => ({
          topic,
          accuracy: Math.round((stats.correct / stats.total) * 100 * 100) / 100
        }))
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 4);
    } catch (error) {
      console.error("Error fetching weak topics:", error);
      throw error;
    }
  }

  async getRecentExams(studentId: string, limit: number = 5): Promise<RecentExam[]> {
    try {
      const { data, error } = await this.client
        .from("exam_attempts")
        .select("id, score, submitted_at, mock_exams(title)")
        .eq("student_id", studentId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (
        data?.map((exam: any) => ({
          id: exam.id,
          title: exam.mock_exams?.title || "Unknown Exam",
          score: Math.round(Number(exam.score) || 0),
          date: new Date(exam.submitted_at).toLocaleDateString()
        })) || []
      );
    } catch (error) {
      console.error("Error fetching recent exams:", error);
      throw error;
    }
  }

  /**
   * `precomputed` lets a caller that already loaded weak topics and performance
   * data reuse them. Without it the student dashboard re-runs both queries here
   * and again in getStudyOverview, tripling the requests behind one page load.
   */
  async getReadinessScore(
    studentId: string,
    precomputed?: { weakTopics?: WeakTopic[]; performanceData?: PerformanceData[] }
  ): Promise<ReadinessData> {
    try {
      const weakTopics = precomputed?.weakTopics ?? (await this.getWeakTopics(studentId));
      const performanceData = precomputed?.performanceData ?? (await this.getPerformanceData(studentId));
      const averageScore = performanceData.length > 0
        ? performanceData.reduce((sum, perf) => sum + perf.score, 0) / performanceData.length
        : 0;

      const weakAreas = weakTopics.filter((topic) => topic.accuracy < 70).map((topic) => topic.topic);
      const readinessScore = Math.min(
        100,
        Math.round(averageScore * 0.7 + (100 - weakAreas.length * 10) * 0.3)
      );

      return {
        score: readinessScore,
        weakAreas
      };
    } catch (error) {
      console.error("Error calculating readiness score:", error);
      throw error;
    }
  }

  async getStudyOverview(
    studentId: string,
    precomputed?: { weakTopics?: WeakTopic[] }
  ): Promise<StudentStudyOverview> {
    const [availableExamsRes, availableReviewersRes, weakTopics] = await Promise.all([
      this.client.from("mock_exams").select("id", { count: "exact", head: true }),
      this.client.from("review_materials").select("id", { count: "exact", head: true }),
      precomputed?.weakTopics ?? this.getWeakTopics(studentId)
    ]);

    return {
      availableExams: availableExamsRes.count ?? 0,
      availableReviewers: availableReviewersRes.count ?? 0,
      recommendedFocus: weakTopics[0]?.topic ?? "Start with a full mock exam"
    };
  }

  async getAvailableSubjects(): Promise<SubjectSummary[]> {
    const { data, error } = await this.client
      .from("mock_exams")
      .select("id, subjects(name)")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const subjectMap = new Map<string, number>();
    (data ?? []).forEach((exam: any) => {
      const subjectName = exam.subjects?.name ?? "Unassigned Subject";
      subjectMap.set(subjectName, (subjectMap.get(subjectName) ?? 0) + 1);
    });

    return Array.from(subjectMap.entries())
      .map(([name, examCount]) => ({ name, examCount }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getSubjectDashboardGraphData(studentId: string): Promise<SubjectDashboardGraphPoint[]> {
    // Step 1: Fetch all questions grouped by subject and chapter.
    // This is a whole-table read, so it has to page past the 1000-row response cap
    // or the chapter inventory silently covers only part of the question bank.
    const questions = await fetchAllRows<any>((from, to) =>
      this.client
        .from("exam_questions")
        .select("id, topics(name), subjects(name), mock_exams(title, subjects(name))")
        .order("id", { ascending: true })
        .range(from, to)
    );

    const subjectChapters = new Map<string, Set<string>>();

    const resolveChapterLabel = (topicName: string | null | undefined, examTitle: string | null | undefined) => {
      return (
        inferChapterLabel(topicName) ??
        inferChapterLabel(examTitle) ??
        (topicName ? stripChapterFromTopic(topicName) : null) ??
        "General"
      );
    };

    // Build complete chapter inventory per subject from ALL available content (exams + quizzes)
    questions.forEach((question: any) => {
      const subjectName = question.subjects?.name ?? question.mock_exams?.subjects?.name ?? "Unassigned Subject";
      const chapterLabel = resolveChapterLabel(question.topics?.name, question.mock_exams?.title);
      const current = subjectChapters.get(subjectName) ?? new Set<string>();
      current.add(chapterLabel);
      subjectChapters.set(subjectName, current);
    });

    // Step 2: Fetch ALL exam and quiz attempts for this student
    const { data: attempts, error: attemptsError } = await this.client
      .from("exam_attempts")
      .select("id, mock_exam_id, score, submitted_at")
      .eq("student_id", studentId)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: true });

    if (attemptsError) {
      throw attemptsError;
    }

    const attemptIds: string[] = [];
    (attempts ?? []).forEach((attempt: any) => {
      attemptIds.push(attempt.id);
    });

    const weakTopicCounts = new Map<string, number>();
    const attemptedChaptersBySubject = new Map<string, Set<string>>();
    const subjectWeakTopicsDetail = new Map<string, Set<string>>();

    // Step 3: Fetch answers from both exams and quizzes to calculate real performance data
    if (attemptIds.length > 0) {
      const answers = await fetchAllRowsForIds<any, string>(attemptIds, (idChunk, from, to) =>
        this.client
          .from("exam_answers")
          .select("is_correct, exam_questions(id, topics(name), subjects(name), mock_exams(title, subjects(name)))")
          .in("attempt_id", idChunk)
          .order("id", { ascending: true })
          .range(from, to)
      );

      // Track accuracy stats per subject-topic combination
      const statsBySubjectTopic = new Map<string, { correct: number; total: number }>();

      answers.forEach((answer: any) => {
        const question = answer.exam_questions;
        if (!question) return;

        const subjectName = question.subjects?.name ?? question.mock_exams?.subjects?.name ?? "Unassigned Subject";
        const topicName = question.topics?.name ?? "General";
        const chapterLabel = resolveChapterLabel(topicName, question.mock_exams?.title);

        // Track which chapters have been attempted
        const attemptedChapters = attemptedChaptersBySubject.get(subjectName) ?? new Set<string>();
        attemptedChapters.add(chapterLabel);
        attemptedChaptersBySubject.set(subjectName, attemptedChapters);

        // Calculate accuracy per topic
        const key = `${subjectName}::${topicName}`;
        const currentStats = statsBySubjectTopic.get(key) ?? { correct: 0, total: 0 };
        currentStats.total += 1;
        if (answer.is_correct) {
          currentStats.correct += 1;
        }
        statsBySubjectTopic.set(key, currentStats);
      });

      // Mark topics with accuracy < 70% as weak spots
      statsBySubjectTopic.forEach((stats, key) => {
        if (stats.total === 0) {
          return;
        }

        const accuracy = (stats.correct / stats.total) * 100;
        if (accuracy < 70) {
          const [subjectName, topicName] = key.split("::");
          
          // Count unique weak topics per subject
          if (!subjectWeakTopicsDetail.has(subjectName)) {
            subjectWeakTopicsDetail.set(subjectName, new Set<string>());
          }
          subjectWeakTopicsDetail.get(subjectName)!.add(topicName);
        }
      });

      // Convert weak topic sets to counts
      subjectWeakTopicsDetail.forEach((topics, subject) => {
        weakTopicCounts.set(subject, topics.size);
      });
    }

    // Step 4: Build dashboard data with real metrics
    return Array.from(subjectChapters.entries())
      .map(([subject, chapters]) => {
        const totalChapters = chapters.size;
        const chaptersTaken = attemptedChaptersBySubject.get(subject)?.size ?? 0;
        const weakTopics = weakTopicCounts.get(subject) ?? 0;

        return {
          subject,
          totalChapters,
          chaptersTaken,
          chaptersLeft: Math.max(0, totalChapters - chaptersTaken),
          weakTopics
        };
      })
      .filter((x) => x.totalChapters > 0) // Only show subjects with actual content
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }

  async getSubjectStatistics(studentId: string): Promise<
    Array<{
      subject: string;
      totalAttempts: number;
      averageScore: number;
      examAttempts: number;
      quizAttempts: number;
      lastAttemptDate: string | null;
    }>
  > {
    try {
      const { data: attempts, error: attemptsError } = await this.client
        .from("exam_attempts")
        .select("id, score, submitted_at, mock_exams(title, subjects(name))")
        .eq("student_id", studentId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });

      if (attemptsError) throw attemptsError;

      const statsBySubject = new Map<
        string,
        {
          scores: number[];
          dates: Date[];
          examCount: number;
          quizCount: number;
        }
      >();

      (attempts ?? []).forEach((attempt: any) => {
        const subject = attempt.mock_exams?.subjects?.name ?? "Unassigned Subject";
        const title = attempt.mock_exams?.title ?? "";
        const isQuiz = title.toLowerCase().includes("quiz");

        if (!statsBySubject.has(subject)) {
          statsBySubject.set(subject, { scores: [], dates: [], examCount: 0, quizCount: 0 });
        }

        const stats = statsBySubject.get(subject)!;
        stats.scores.push(attempt.score || 0);
        stats.dates.push(new Date(attempt.submitted_at));
        if (isQuiz) {
          stats.quizCount++;
        } else {
          stats.examCount++;
        }
      });

      return Array.from(statsBySubject.entries())
        .map(([subject, stats]) => ({
          subject,
          totalAttempts: stats.scores.length,
          averageScore: stats.scores.length > 0 ? Math.round((stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) * 100) / 100 : 0,
          examAttempts: stats.examCount,
          quizAttempts: stats.quizCount,
          lastAttemptDate: stats.dates.length > 0 ? stats.dates[0].toISOString().split("T")[0] : null
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject));
    } catch (error) {
      console.error("Error fetching subject statistics:", error);
      throw error;
    }
  }

  private async calculateStudyStreak(studentId: string): Promise<number> {
    try {
      const { data, error } = await this.client
        .from("exam_attempts")
        .select("submitted_at")
        .eq("student_id", studentId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return 0;

      const studiedDays = new Set(data.map((attempt) => new Date(attempt.submitted_at).toDateString()));
      const today = new Date();

      const dayOffset = (offset: number) => {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        return date.toDateString();
      };

      // A student who has not practised yet today still has an unbroken streak,
      // so start counting at yesterday when today has no attempt.
      let offset = studiedDays.has(dayOffset(0)) ? 0 : 1;

      if (offset === 1 && !studiedDays.has(dayOffset(1))) {
        return 0;
      }

      let streak = 0;
      while (studiedDays.has(dayOffset(offset))) {
        streak++;
        offset++;
      }

      return streak;
    } catch (error) {
      console.error("Error calculating study streak:", error);
      return 0;
    }
  }
}
