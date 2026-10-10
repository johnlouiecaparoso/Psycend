"use client";

import * as React from "react";
import { RotateCcw, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { inferChapterLabel, stripChapterFromTopic } from "@/lib/review-content";
import type { ParsedImportRow, ReviewQuestion, StudyTechnique } from "@/lib/types";

type FlashcardItem = ParsedImportRow | ReviewQuestion;
type ReviewMark = "know" | "hard" | "again";

/**
 * Cards show the full prompt and the full answer. Both sides used to be clipped
 * (the question to ten words, the answer to two), which left the study text
 * unreadable — "Negative reinforcement removes an aversive stimulus" rendered as
 * "Negative reinforcement...".
 */
function buildFlashcardPrompt(question: string) {
  return question.replace(/\s+/g, " ").trim();
}

function buildFlashcardAnswer(answer: string) {
  return answer.replace(/\s+/g, " ").trim();
}

/** Long answers need a smaller type scale so they still fit the card. */
function getAnswerTextClass(answer: string) {
  if (answer.length > 220) {
    return "text-base leading-snug sm:text-lg";
  }

  if (answer.length > 90) {
    return "text-lg leading-snug sm:text-xl";
  }

  return "text-xl leading-tight sm:text-3xl";
}

function getPromptTextClass(prompt: string) {
  if (prompt.length > 220) {
    return "text-sm leading-snug sm:text-base";
  }

  if (prompt.length > 90) {
    return "text-base leading-snug sm:text-lg";
  }

  return "text-lg leading-tight sm:text-2xl";
}

function shuffleItems<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function FlashcardDeck({
  cards,
  weakTopics = [],
  studyTechnique = "practice_test"
}: {
  cards: FlashcardItem[];
  weakTopics?: string[];
  studyTechnique?: StudyTechnique;
}) {
  const [selectedSubject, setSelectedSubject] = React.useState("all");
  const [selectedChapter, setSelectedChapter] = React.useState("all");
  const [selectedTopic, setSelectedTopic] = React.useState("all");
  const [shuffleMode, setShuffleMode] = React.useState(studyTechnique === "active_recall");
  const [weakOnly, setWeakOnly] = React.useState(studyTechnique === "active_recall" && weakTopics.length > 0);
  const [orderedCards, setOrderedCards] = React.useState<FlashcardItem[]>(cards);
  const [index, setIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [reviewState, setReviewState] = React.useState<Record<string, ReviewMark>>({});

  const subjects = React.useMemo(() => ["all", ...Array.from(new Set(cards.map((card) => card.subject)))], [cards]);
  const chapters = React.useMemo(() => {
    const filteredBySubject = selectedSubject === "all" ? cards : cards.filter((card) => card.subject === selectedSubject);
    return [
      "all",
      ...Array.from(new Set(filteredBySubject.map((card) => inferChapterLabel(card.topic) ?? "General")))
    ];
  }, [cards, selectedSubject]);
  const topics = React.useMemo(() => {
    const filteredBySubject = selectedSubject === "all" ? cards : cards.filter((card) => card.subject === selectedSubject);
    const filteredByChapter = selectedChapter === "all"
      ? filteredBySubject
      : filteredBySubject.filter((card) => (inferChapterLabel(card.topic) ?? "General") === selectedChapter);
    return ["all", ...Array.from(new Set(filteredByChapter.map((card) => stripChapterFromTopic(card.topic))))];
  }, [cards, selectedChapter, selectedSubject]);

  const filteredCards = React.useMemo(() => {
    return cards.filter((card) => {
      const subjectMatch = selectedSubject === "all" || card.subject === selectedSubject;
      const chapterMatch = selectedChapter === "all" || (inferChapterLabel(card.topic) ?? "General") === selectedChapter;
      const topicMatch = selectedTopic === "all" || stripChapterFromTopic(card.topic) === selectedTopic;
      const weakMatch = !weakOnly || weakTopics.includes(card.topic);
      return subjectMatch && chapterMatch && topicMatch && weakMatch;
    });
  }, [cards, selectedChapter, selectedSubject, selectedTopic, weakOnly, weakTopics]);

  React.useEffect(() => {
    const nextCards = shuffleMode ? shuffleItems(filteredCards) : filteredCards;
    setOrderedCards(nextCards);
    setIndex(0);
    setFlipped(false);
  }, [filteredCards, shuffleMode]);

  React.useEffect(() => {
    if (studyTechnique === "active_recall") {
      setShuffleMode(true);
      if (weakTopics.length > 0) {
        setWeakOnly(true);
      }
    }
  }, [studyTechnique, weakTopics.length]);

  const current = orderedCards[index];
  const progress = orderedCards.length > 0 ? (Object.keys(reviewState).length / orderedCards.length) * 100 : 0;
  const correctChoice = current?.choices.find((choice) => choice.is_correct);
  const promptText = current ? buildFlashcardPrompt(current.question_text) : "";
  const answerText = buildFlashcardAnswer(correctChoice?.choice_text ?? "No answer available");

  const subjectProgress = React.useMemo(() => {
    const subjectMap = new Map<string, { total: number; know: number; hard: number; again: number }>();
    orderedCards.forEach((card) => {
      const currentStats = subjectMap.get(card.subject) ?? { total: 0, know: 0, hard: 0, again: 0 };
      currentStats.total += 1;
      const mark = reviewState[(card as ReviewQuestion).id ?? `${card.subject}-${card.topic}-${card.question_text}`];
      if (mark === "know") currentStats.know += 1;
      if (mark === "hard") currentStats.hard += 1;
      if (mark === "again") currentStats.again += 1;
      subjectMap.set(card.subject, currentStats);
    });
    return Array.from(subjectMap.entries());
  }, [orderedCards, reviewState]);

  function getCardKey(card: FlashcardItem) {
    return (card as ReviewQuestion).id ?? `${card.subject}-${card.topic}-${card.question_text}`;
  }

  function markCard(state: ReviewMark) {
    setReviewState((prev) => ({ ...prev, [getCardKey(current)]: state }));
    setFlipped(false);
    setIndex((value) => (value + 1 < orderedCards.length ? value + 1 : value));
  }

  if (orderedCards.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Flashcards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select value={selectedSubject} onChange={(event) => { setSelectedSubject(event.target.value); setSelectedChapter("all"); setSelectedTopic("all"); }} className="h-11 w-full min-w-0 rounded-2xl border bg-background px-4 py-2 text-sm text-foreground">
              {subjects.map((subject) => <option key={subject} value={subject}>{subject === "all" ? "All subjects" : subject}</option>)}
            </select>
            <select value={selectedChapter} onChange={(event) => { setSelectedChapter(event.target.value); setSelectedTopic("all"); }} className="h-11 w-full min-w-0 rounded-2xl border bg-background px-4 py-2 text-sm text-foreground">
              {chapters.map((chapter) => <option key={chapter} value={chapter}>{chapter === "all" ? "All chapters" : chapter}</option>)}
            </select>
            <select value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)} className="h-11 w-full min-w-0 rounded-2xl border bg-background px-4 py-2 text-sm text-foreground">
              {topics.map((topic) => <option key={topic} value={topic}>{topic === "all" ? "All topics" : topic}</option>)}
            </select>
            <Button className="w-full" variant={shuffleMode ? "default" : "outline"} onClick={() => setShuffleMode((value) => !value)}><Shuffle className="mr-2 h-4 w-4" />{shuffleMode ? "Shuffle on" : "Shuffle off"}</Button>
            <Button className="w-full" variant={weakOnly ? "default" : "outline"} onClick={() => setWeakOnly((value) => !value)} disabled={weakTopics.length === 0}>Weak topics only</Button>
          </div>
          <p className="text-sm text-muted-foreground">No flashcards match the selected filters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Flashcards</CardTitle>
            <div className="text-sm text-muted-foreground">{index + 1} / {orderedCards.length}</div>
          </div>
          <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {studyTechnique === "active_recall"
              ? "Active Recall mode keeps answers hidden, shuffles the deck, and focuses weak topics first."
              : studyTechnique === "pomodoro"
                ? "Pomodoro mode works best when you finish one uninterrupted card round before taking a short break."
                : "Practice Test mode lets you warm up on cards before taking a full timed set."}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select value={selectedSubject} onChange={(event) => { setSelectedSubject(event.target.value); setSelectedChapter("all"); setSelectedTopic("all"); }} className="h-11 w-full min-w-0 rounded-2xl border bg-background px-4 py-2 text-sm text-foreground">
              {subjects.map((subject) => <option key={subject} value={subject}>{subject === "all" ? "All subjects" : subject}</option>)}
            </select>
            <select value={selectedChapter} onChange={(event) => { setSelectedChapter(event.target.value); setSelectedTopic("all"); }} className="h-11 w-full min-w-0 rounded-2xl border bg-background px-4 py-2 text-sm text-foreground">
              {chapters.map((chapter) => <option key={chapter} value={chapter}>{chapter === "all" ? "All chapters" : chapter}</option>)}
            </select>
            <select value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)} className="h-11 w-full min-w-0 rounded-2xl border bg-background px-4 py-2 text-sm text-foreground">
              {topics.map((topic) => <option key={topic} value={topic}>{topic === "all" ? "All topics" : topic}</option>)}
            </select>
            <Button className="w-full" variant={shuffleMode ? "default" : "outline"} onClick={() => setShuffleMode((value) => !value)}><Shuffle className="mr-2 h-4 w-4" />{shuffleMode ? "Shuffle on" : "Shuffle off"}</Button>
            <Button className="w-full" variant={weakOnly ? "default" : "outline"} onClick={() => setWeakOnly((value) => !value)} disabled={weakTopics.length === 0}>Weak topics only</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progress} />
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{current.subject}</Badge>
            <Badge variant="outline">{inferChapterLabel(current.topic) ?? "General"}</Badge>
            <Badge variant="outline">{stripChapterFromTopic(current.topic)}</Badge>
            {weakTopics.includes(current.topic) ? <Badge>Weak area</Badge> : null}
          </div>
          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            className="grid min-h-[280px] w-full overflow-hidden grid-rows-[auto_1fr] rounded-[22px] border border-border bg-gradient-to-br from-emerald-50 via-background to-amber-50 p-4 text-left text-foreground transition-colors sm:min-h-[320px] sm:rounded-[28px] sm:p-8 dark:from-emerald-950/40 dark:via-slate-900 dark:to-amber-950/30"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="max-w-[calc(100%-2rem)] rounded-full bg-background px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.2em]">{flipped ? "Answer" : "Quick prompt"}</span>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-center overflow-y-auto py-4 text-center">
              {flipped ? (
                <div className="w-full max-w-full">
                  <h3 className={`break-words font-semibold ${getAnswerTextClass(answerText)}`}>{answerText}</h3>
                  <p className="mt-4 text-sm text-muted-foreground">Correct option: {correctChoice?.choice_key ?? "-"}</p>
                  {current.explanation ? (
                    <p className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
                      {current.explanation}
                    </p>
                  ) : null}
                </div>
              ) : (
                <h3 className={`break-words font-semibold ${getPromptTextClass(promptText)}`}>{promptText}</h3>
              )}
            </div>
          </button>

          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => markCard("again")}>Again</Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => markCard("hard")}>Hard</Button>
            <Button className="w-full sm:w-auto" onClick={() => markCard("know")}>Know</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progress per subject</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subjectProgress.map(([subject, stats]) => {
            const completed = stats.know + stats.hard + stats.again;
            const subjectValue = stats.total > 0 ? (completed / stats.total) * 100 : 0;
            return (
              <div key={subject} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{subject}</span>
                  <span className="text-muted-foreground">{completed} / {stats.total} reviewed</span>
                </div>
                <Progress value={subjectValue} />
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Know: {stats.know}</span>
                  <span>Hard: {stats.hard}</span>
                  <span>Again: {stats.again}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

