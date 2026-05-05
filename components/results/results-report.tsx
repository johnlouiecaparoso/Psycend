"use client";

import * as React from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getReadiness } from "@/lib/utils";
import type { AttemptResult } from "@/lib/types";
import type { OfflineAttemptResult } from "@/lib/offline-exam-store";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type ResultData = AttemptResult | OfflineAttemptResult;

function formatChoiceLabel(
  choiceKey: "A" | "B" | "C" | "D" | null,
  choices: ResultData["items"][number]["choices"]
) {
  if (!choiceKey) {
    return "No answer";
  }

  const matchedChoice = choices.find((choice) => choice.choice_key === choiceKey);
  return matchedChoice ? `${choiceKey}. ${matchedChoice.choice_text}` : choiceKey;
}

export function ResultsReport({
  result,
  title = "Exam results",
  description = "Review your score breakdown, explanations, and weak topics before the next mock exam."
}: {
  result: ResultData;
  title?: string;
  description?: string;
}) {
  const readiness = getReadiness(result.score);
  const isOfflineResult = "queuedForSync" in result;

  return (
    <div id="results-report" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={() => window.print()}>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {isOfflineResult ? (
        <Card className="print:shadow-none">
          <CardContent className="p-6 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Offline result for {(result as OfflineAttemptResult).examTitle} | Subject: {(result as OfflineAttemptResult).subject} | Submitted: {new Date((result as OfflineAttemptResult).submittedAt).toLocaleString()} | Sync status: {(result as OfflineAttemptResult).queuedForSync ? "Queued for sync" : "Synced"}
              </span>
              {!((result as OfflineAttemptResult).queuedForSync) && (result as OfflineAttemptResult).serverAttemptId ? (
                <Link href={`/student/results/${(result as OfflineAttemptResult).serverAttemptId}`} className={cn(buttonVariants({ variant: "outline" }), "print:hidden")}>
                  Open synced result
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="print:shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Score</p>
            <p className="mt-2 text-3xl font-bold">{result.score}%</p>
          </CardContent>
        </Card>
        <Card className="print:shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Correct answers</p>
            <p className="mt-2 text-3xl font-bold">{result.correctCount} / {result.totalItems}</p>
          </CardContent>
        </Card>
        <Card className="print:shadow-none">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Readiness</p>
            <p className={`mt-2 text-3xl font-bold ${readiness.tone}`}>{readiness.label}</p>
          </CardContent>
        </Card>
      </section>

      <Card className="print:shadow-none">
        <CardHeader>
          <CardTitle>Weak topics</CardTitle>
        </CardHeader>
        <CardContent>
          {result.weakTopics.length === 0 ? (
            <p className="text-sm text-emerald-600">No weak topics detected in this attempt.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {result.weakTopics.map((topic) => (
                <span key={topic} className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  {topic}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="print:shadow-none">
        <CardHeader>
          <CardTitle>Answer review and explanations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.items.map((item) => (
            <div key={item.questionId} className="rounded-2xl bg-muted/40 p-4 break-inside-avoid">
              <p className="font-semibold">{item.questionText}</p>
              <p className="mt-2 text-sm text-muted-foreground">Subject: {item.subject} | Topic: {item.topic}</p>
              <p className="mt-3 text-sm">
                Your answer: <span className={item.isCorrect ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>{formatChoiceLabel(item.selectedChoice, item.choices)}</span>
              </p>
              <p className="mt-1 text-sm">Correct answer: <span className="font-semibold">{formatChoiceLabel(item.correctChoice, item.choices)}</span></p>
              <p className="mt-3 text-sm text-muted-foreground">{item.explanation}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
