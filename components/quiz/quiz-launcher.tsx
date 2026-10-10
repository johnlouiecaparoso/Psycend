"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Download, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOfflineStudyPack } from "@/components/exam/use-offline-study-pack";
import { compareChapterLabels } from "@/lib/review-content";
import type { MockExamSummary } from "@/lib/types";

function extractChapterBase(label: string) {
  const match = label.match(/^(chapter\s*[0-9]+(?:\s*[-–]\s*[0-9]+)?)/i);
  return match ? match[1].trim() : label.trim();
}

function normalizeTopicForDisplay(value: string, chapterBase: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutChapterPrefix = trimmed
    .replace(/^chapter\s*[0-9]+(?:\s*[-–]\s*[0-9]+)?\s*:\s*/i, "")
    .replace(/^chapter\s*[0-9]+(?:\s*[-–]\s*[0-9]+)?\s+/i, "")
    .trim();

  const repeatedPhraseMatch = withoutChapterPrefix.match(/^(.+?)\s*:\s*\1$/i);
  const collapsed = repeatedPhraseMatch ? repeatedPhraseMatch[1].trim() : withoutChapterPrefix;

  if (!collapsed) {
    return "";
  }

  if (collapsed.toLowerCase() === chapterBase.toLowerCase()) {
    return "";
  }

  if (/^chapter\s*[0-9]+(?:\s*[-–]\s*[0-9]+)?$/i.test(collapsed)) {
    return "";
  }

  return collapsed;
}

function buildChapterDisplayTitle(exam: MockExamSummary & { chapterLabel: string }) {
  const chapterLabel = exam.chapter ?? exam.chapterLabel;
  const chapterBase = extractChapterBase(chapterLabel);
  const descriptorFromLabel = normalizeTopicForDisplay(chapterLabel.slice(chapterBase.length), chapterBase);
  if (descriptorFromLabel) {
    return `${chapterBase} ${descriptorFromLabel}`;
  }

  const topic = exam.topics
    .map((item) => normalizeTopicForDisplay(item, chapterBase))
    .find((item) => Boolean(item));

  return topic ? `${chapterBase} ${topic}` : chapterLabel;
}

const LIMIT_PRESETS = [5, 10, 15, 20, 25, 30, 35, 40];

/**
 * Filtering the presets alone left the dropdown empty for chapters with fewer
 * than five questions, so always offer the full set as a choice too.
 */
function buildLimitOptions(questionCount: number) {
  if (questionCount <= 0) {
    return [];
  }

  const cappedCount = Math.min(questionCount, 40);
  const options = new Set(LIMIT_PRESETS.filter((value) => value <= questionCount));
  options.add(cappedCount);

  return Array.from(options).sort((left, right) => left - right);
}

export function QuizLauncher({ exams }: { exams: MockExamSummary[] }) {
  const router = useRouter();
  const [limits, setLimits] = React.useState<Record<string, string>>({});
  const [durations, setDurations] = React.useState<Record<string, string>>({});
  const [shuffle, setShuffle] = React.useState<Record<string, boolean>>({});
  const [selectedSubject, setSelectedSubject] = React.useState("all");
  const [selectedChapter, setSelectedChapter] = React.useState("all");
  const [selectedTopic, setSelectedTopic] = React.useState("all");
  const [openExamId, setOpenExamId] = React.useState<string | null>(null);
  const { downloadState, availableOffline, downloadPack, openOfflinePack } = useOfflineStudyPack(exams);
  const examsBySubject = React.useMemo(() => {
    const grouped = new Map<string, MockExamSummary[]>();

    exams.forEach((exam) => {
      const current = grouped.get(exam.subject) ?? [];
      current.push(exam);
      grouped.set(exam.subject, current);
    });

    return Array.from(grouped.entries())
      .map(([subject, subjectExams]) => ({
        subject,
        exams: subjectExams
          .map((exam, index) => ({
            ...exam,
            chapterLabel: exam.chapter ?? `Chapter ${index + 1}`
          }))
          .sort((left, right) => compareChapterLabels(left.chapter ?? left.chapterLabel, right.chapter ?? right.chapterLabel))
      }))
      .sort((left, right) => left.subject.localeCompare(right.subject, undefined, { sensitivity: "base", numeric: true }));
  }, [exams]);
  const subjectOptions = React.useMemo(() => ["all", ...examsBySubject.map((group) => group.subject)], [examsBySubject]);
  const activeSubject = React.useMemo(
    () => examsBySubject.find((group) => group.subject === selectedSubject) ?? null,
    [examsBySubject, selectedSubject]
  );

  React.useEffect(() => {
    setOpenExamId(null);
    setSelectedChapter("all");
    setSelectedTopic("all");
  }, [selectedSubject]);

  const chapterOptions = React.useMemo(() => {
    if (!activeSubject) {
      return ["all"];
    }

    return [
      "all",
      ...Array.from(new Set(activeSubject.exams.map((exam) => exam.chapter ?? exam.chapterLabel))).sort(compareChapterLabels)
    ];
  }, [activeSubject]);

  const topicOptions = React.useMemo(() => {
    if (!activeSubject) {
      return ["all"];
    }

    const source = selectedChapter === "all"
      ? activeSubject.exams
      : activeSubject.exams.filter((exam) => (exam.chapter ?? exam.chapterLabel) === selectedChapter);

    return [
      "all",
      ...Array.from(new Set(source.flatMap((exam) => exam.topics))).sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base", numeric: true })
      )
    ];
  }, [activeSubject, selectedChapter]);

  const compactSelectClassName =
    "min-w-0 h-10 w-full max-w-full rounded-xl border bg-background px-3 py-2 text-xs text-foreground sm:h-11 sm:rounded-2xl sm:px-4 sm:text-sm";

  const disabledSelectClassName =
    "min-w-0 h-10 w-full max-w-full rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground sm:h-11 sm:rounded-2xl sm:px-4 sm:text-sm";

  function startQuiz(exam: MockExamSummary) {
    const limit = limits[exam.id] ?? String(Math.min(10, exam.questionCount));
    const defaultDuration = Math.max(Number.parseInt(limit, 10) * 2, 10);
    const duration = Math.max(5, Number.parseInt(durations[exam.id] ?? String(defaultDuration), 10) || defaultDuration).toString();
    const shouldShuffle = shuffle[exam.id] ?? true;
    const params = new URLSearchParams({
      mode: "quiz",
      limit,
      duration,
      seed: Date.now().toString()
    });

    if (shouldShuffle) {
      params.set("shuffle", "1");
    }

    if (exam.chapter) {
      params.set("chapter", exam.chapter);
    }

    if (selectedTopic !== "all") {
      params.set("topic", selectedTopic);
    }

    router.push(`/student/mock-exams/${exam.sourceExamId}?${params.toString()}`);
  }

  if (!activeSubject) {
    return (
      <section className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={selectedSubject}
            onChange={(event) => setSelectedSubject(event.target.value)}
            className={compactSelectClassName}
          >
            {subjectOptions.map((subject) => (
              <option key={subject} value={subject}>
                {subject === "all" ? "All subjects" : subject}
              </option>
            ))}
          </select>
          <select value="all" disabled className={disabledSelectClassName}>
            <option>Choose a subject first</option>
          </select>
          <select value="all" disabled className={disabledSelectClassName}>
            <option>Choose a chapter first</option>
          </select>
        </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {examsBySubject
          .filter(({ subject }) => selectedSubject === "all" || subject === selectedSubject)
          .map(({ subject, exams: subjectExams }) => (
          <button
            key={subject}
            type="button"
            onClick={() => setSelectedSubject(subject)}
            className="rounded-2xl border border-border bg-card p-6 text-left text-card-foreground shadow-soft transition-colors hover:border-primary/50 hover:bg-muted/20"
          >
            <h2 className="text-xl font-semibold">{subject}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {subjectExams.length} chapter{subjectExams.length === 1 ? "" : "s"}
            </p>
          </button>
        ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setSelectedSubject("all")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to subjects
        </Button>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-semibold sm:text-2xl">{activeSubject.subject}</h2>
          <p className="text-sm text-muted-foreground">Choose a chapter to begin.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <select
          value={selectedSubject}
          onChange={(event) => setSelectedSubject(event.target.value)}
          className={compactSelectClassName}
        >
          {subjectOptions.map((subject) => (
            <option key={subject} value={subject}>
              {subject === "all" ? "All subjects" : subject}
            </option>
          ))}
        </select>
        <select
          value={selectedChapter}
          onChange={(event) => {
            setSelectedChapter(event.target.value);
            setSelectedTopic("all");
          }}
          className={compactSelectClassName}
        >
          {chapterOptions.map((chapter) => (
            <option key={chapter} value={chapter}>
              {chapter === "all" ? "All chapters" : chapter}
            </option>
          ))}
        </select>
        <select
          value={selectedTopic}
          onChange={(event) => setSelectedTopic(event.target.value)}
          className={compactSelectClassName}
        >
          {topicOptions.map((topic) => (
            <option key={topic} value={topic}>
              {topic === "all" ? "All topics" : topic}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-2">
        {activeSubject.exams
          .filter((exam) => {
            const chapterMatch = selectedChapter === "all" || (exam.chapter ?? exam.chapterLabel) === selectedChapter;
            const topicMatch = selectedTopic === "all" || exam.topics.includes(selectedTopic);
            return chapterMatch && topicMatch;
          })
          .map((exam) => {
          const defaultLimit = Math.min(10, exam.questionCount);
          const selectedLimit = limits[exam.id] ?? String(defaultLimit);
          const selectedDuration = durations[exam.id] ?? String(Math.max(defaultLimit * 2, 10));
          const isShuffled = shuffle[exam.id] ?? true;
          const isOpen = openExamId === exam.id;
          const chapterDisplayTitle = buildChapterDisplayTitle(exam);

          return (
            <Card key={exam.id}>
              <CardHeader className="space-y-0">
                <button
                  type="button"
                  onClick={() => setOpenExamId((current) => (current === exam.id ? null : exam.id))}
                  className="flex w-full items-start justify-between gap-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{chapterDisplayTitle}</CardTitle>
                      {availableOffline[exam.id] ? <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Offline ready</span> : null}
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </CardHeader>
              <CardContent className={isOpen ? "space-y-4" : "hidden"}>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>{exam.questionCount} questions available</span>
                  <span>{exam.topicCount} topics</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {exam.topics.slice(0, 4).map((topic) => (
                    <span key={`${exam.id}-${topic}`} className="rounded-full bg-muted px-3 py-1">
                      {topic}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Question limit</label>
                  <select
                    value={selectedLimit}
                    onChange={(event) => setLimits((prev) => ({ ...prev, [exam.id]: event.target.value }))}
                    className="h-11 w-full rounded-2xl border bg-background px-4 py-2 text-sm text-foreground"
                  >
                    {buildLimitOptions(exam.questionCount).map((value) => (
                      <option key={`${exam.id}-${value}`} value={value}>
                        {value} items
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quiz time in minutes</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    step={5}
                    value={selectedDuration}
                    onChange={(event) => setDurations((prev) => ({ ...prev, [exam.id]: event.target.value }))}
                    className="h-11 w-full rounded-2xl border bg-background px-4 py-2 text-sm text-foreground"
                  />
                </div>
                <label className="flex items-center justify-between rounded-2xl border bg-muted/30 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <Shuffle className="h-4 w-4" />
                    Shuffle questions
                  </span>
                  <input
                    type="checkbox"
                    checked={isShuffled}
                    onChange={(event) => setShuffle((prev) => ({ ...prev, [exam.id]: event.target.checked }))}
                  />
                </label>
                <div className="grid gap-3">
                  <Button className="w-full" onClick={() => startQuiz(exam)}>
                    Start quiz
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" className="w-full" onClick={() => void downloadPack(exam)}>
                    <Download className="mr-2 h-4 w-4" />
                    {downloadState[exam.id] === "downloading"
                      ? "Downloading..."
                      : downloadState[exam.id] === "saved"
                        ? "Saved offline"
                        : "Download offline"}
                  </Button>
                  {availableOffline[exam.id] ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() =>
                        openOfflinePack({
                          exam,
                          mode: "quiz",
                          limit: selectedLimit,
                          duration: selectedDuration,
                          shuffle: isShuffled
                        })}
                    >
                      Open offline quiz
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
