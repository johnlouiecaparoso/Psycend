"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { WeakTopicsChart } from "@/components/charts/weak-topics-chart";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { DashboardService, type StudentStats, type PerformanceData, type RecentExam, type StudentStudyOverview, type WeakTopic } from "@/lib/supabase/dashboard-service";
import { StudyTechniqueService } from "@/lib/supabase/study-technique-client";
import { ROLE_LABELS } from "@/lib/constants";
import { getReadiness, cn } from "@/lib/utils";
import type { CurrentStudyTechnique } from "@/lib/supabase/study-technique-types";

export default function StudentPage() {
  const { userId, userRole, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [recentExams, setRecentExams] = useState<RecentExam[]>([]);
  const [studyOverview, setStudyOverview] = useState<StudentStudyOverview | null>(null);
  const [currentTechnique, setCurrentTechnique] = useState<CurrentStudyTechnique | null>(null);
  const [readinessScore, setReadinessScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userId || authLoading) return;

      try {
        const dashboardService = new DashboardService();
        const studyTechniqueService = new StudyTechniqueService();
        const [statsData, performanceData, weakTopicsData, recentExamsData, currentTechniqueData] = await Promise.all([
          dashboardService.getStudentStats(userId),
          dashboardService.getPerformanceData(userId),
          dashboardService.getWeakTopics(userId),
          dashboardService.getRecentExams(userId),
          studyTechniqueService.getCurrentStudyTechnique(userId)
        ]);

        // Readiness and the study overview derive from data already loaded above,
        // so hand it over instead of letting them re-query the same tables.
        const [readinessData, studyOverviewData] = await Promise.all([
          dashboardService.getReadinessScore(userId, { weakTopics: weakTopicsData, performanceData }),
          dashboardService.getStudyOverview(userId, { weakTopics: weakTopicsData })
        ]);

        setStats(statsData);
        setPerformanceData(performanceData);
        setWeakTopics(weakTopicsData);
        setRecentExams(recentExamsData);
        setReadinessScore(readinessData.score);
        setStudyOverview(studyOverviewData);
        setCurrentTechnique(currentTechniqueData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboardData();
  }, [userId, authLoading]);

  const readiness = getReadiness(readinessScore);
  const role = userRole === "student" ? "student" : "student";
  const activeTechnique = currentTechnique;

  if (loading || authLoading) {
    return (
      <AppShell role={role} title="Student dashboard" description="Track readiness, weak areas, recent performance, and study momentum from one clean workspace.">
        <div className="flex items-center justify-center h-64"><p>Loading dashboard...</p></div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell role={role} title="Student dashboard" description="Track readiness, weak areas, recent performance, and study momentum from one clean workspace.">
        <div className="flex items-center justify-center h-64"><p className="text-red-500">Error: {error}</p></div>
      </AppShell>
    );
  }

  const statCards = [
    { label: "Total Exams", value: stats?.totalExams?.toString() || "0", helper: "Exams completed" },
    { label: "Average Score", value: `${stats?.averageScore || 0}%`, helper: "Across all subjects" },
    { label: "Study Streak", value: `${stats?.studyStreak || 0} days`, helper: "Consecutive days" },
    { label: "Study Time", value: `${stats?.totalTime || 0} min`, helper: "Estimated focused practice" }
  ];

  return (
    <AppShell role={role} title={`${ROLE_LABELS.student} dashboard`} description="Track readiness, weak areas, recent performance, and study momentum from one clean workspace.">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>Next best move</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="break-words text-xl font-semibold sm:text-2xl">{studyOverview?.recommendedFocus ?? "Start with a mock exam"}</p>
            <p className="text-sm text-muted-foreground">
              Recommended focus based on your weakest available topic, recent study history, and your current {activeTechnique?.name ?? "default review"} mode.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Available mock exams</p>
                <p className="mt-2 text-2xl font-bold">{studyOverview?.availableExams ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Reviewer PDFs</p>
                <p className="mt-2 text-2xl font-bold">{studyOverview?.availableReviewers ?? 0}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap">
              {activeTechnique ? <Link href={activeTechnique.recommended_href as any} className={cn(buttonVariants(), "w-full xl:w-auto")}>{activeTechnique.recommended_action_label}</Link> : null}
              <Link href="/student/mock-exams" className={cn(buttonVariants({ variant: "outline" }), "w-full xl:w-auto")}>Mock exams</Link>
              <Link href="/student/flashcards" className={cn(buttonVariants({ variant: "outline" }), "w-full xl:w-auto")}>Flashcards</Link>
              <Link href="/student/reviewers" className={cn(buttonVariants({ variant: "outline" }), "w-full xl:w-auto")}>Open reviewers</Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Readiness indicator</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className={`text-4xl font-bold ${readiness.tone}`}>{readinessScore}%</p>
            <p className="font-semibold">{readiness.label}</p>
            <Progress value={readinessScore} />
            <p className="text-sm text-muted-foreground">
              {readinessScore >= 80 ? "Great job! You're ready for the exam." : readinessScore >= 60 ? "Keep improving to reach optimal readiness." : "Focus on weak areas to build readiness."}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Subject performance</CardTitle></CardHeader>
          <CardContent>
            {performanceData.length === 0 ? <p className="text-sm text-muted-foreground">No completed exams yet.</p> : <PerformanceChart data={performanceData} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Weak topic detection</CardTitle></CardHeader>
          <CardContent>
            {weakTopics.length === 0 ? <p className="text-sm text-muted-foreground">No weak topics yet. Complete an exam first.</p> : <WeakTopicsChart data={weakTopics} />}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>Recent exams</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {recentExams.length === 0 ? (
              <p className="text-muted-foreground">No exams taken yet</p>
            ) : (
              recentExams.map((exam) => (
                <div key={exam.id} className="rounded-2xl bg-muted/50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="break-words font-semibold">{exam.title}</p>
                    <p className="text-sm font-semibold text-primary">{exam.score}%</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{exam.date}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Mode-aware reminders</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {activeTechnique?.slug === "active_recall" ? (
              <>
                <p>Say the answer out loud before flipping each flashcard.</p>
                <p>Move your missed cards into another short recall round before you stop.</p>
                <p>Use quick quiz after flashcards to test the same topic without rereading first.</p>
              </>
            ) : null}
            {activeTechnique?.slug === "pomodoro" ? (
              <>
                <p>Finish one full 25-minute block before checking messages or notes.</p>
                <p>Use your break to rest, not to switch into another distracting app.</p>
                <p>Stack two focus rounds on your weakest subject before changing topics.</p>
              </>
            ) : null}
            {activeTechnique?.slug === "practice_test" || !activeTechnique ? (
              <>
                <p>Run at least one timed set with shuffled questions this week.</p>
                <p>Review explanations only after you submit the full attempt.</p>
                <p>Retake weak subjects after 24 to 48 hours for spaced repetition.</p>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
