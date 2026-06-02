"use client";

import * as React from "react";
import { BellRing, Clock3, Coffee, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_POMODORO_STATE,
  getNextPomodoroState,
  getPomodoroSecondsForPhase,
  POMODORO_STATE_EVENT,
  playPomodoroRingtone,
  readPomodoroState,
  type PomodoroPhase,
  type StoredPomodoroState,
  writePomodoroState
} from "@/lib/pomodoro-state";
import { StudyTechniqueService } from "@/lib/supabase/study-technique-client";
import type { StudyTechnique } from "@/lib/types";
import { cn } from "@/lib/utils";

const TECHNIQUE_CACHE_KEY = "psycend-active-study-technique";

export function FloatingPomodoroWidget() {
  const { userId, userRole, loading } = useAuth();
  const [isPomodoroMode, setIsPomodoroMode] = React.useState(false);
  const [state, setState] = React.useState<StoredPomodoroState>(DEFAULT_POMODORO_STATE);
  const [hasHydratedState, setHasHydratedState] = React.useState(false);
  const [isMobileView, setIsMobileView] = React.useState(false);
  const audioPrimedRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setState(readPomodoroState());
    setHasHydratedState(true);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateViewportState = () => setIsMobileView(mediaQuery.matches);
    updateViewportState();

    mediaQuery.addEventListener("change", updateViewportState);
    return () => mediaQuery.removeEventListener("change", updateViewportState);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedState) {
      return;
    }

    writePomodoroState(state);
  }, [hasHydratedState, state]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncState = () => {
      setState((current) => {
        const next = readPomodoroState();
        return JSON.stringify(current) === JSON.stringify(next) ? current : next;
      });
    };

    window.addEventListener(POMODORO_STATE_EVENT, syncState as EventListener);
    window.addEventListener("storage", syncState);

    return () => {
      window.removeEventListener(POMODORO_STATE_EVENT, syncState as EventListener);
      window.removeEventListener("storage", syncState);
    };
  }, []);

  React.useEffect(() => {
    if (loading || userRole !== "student" || !userId) {
      setIsPomodoroMode(false);
      return;
    }

    let active = true;
    const studyTechniqueService = new StudyTechniqueService();

    const resolveTechnique = async () => {
      const cachedTechnique = window.localStorage.getItem(TECHNIQUE_CACHE_KEY) as StudyTechnique | null;
      if (cachedTechnique === "pomodoro") {
        setIsPomodoroMode(true);
      }

      try {
        const currentTechnique = await studyTechniqueService.getCurrentStudyTechnique(userId);
        if (!active) {
          return;
        }

        const isPomodoro = currentTechnique?.slug === "pomodoro";
        setIsPomodoroMode(isPomodoro);
        window.localStorage.setItem(TECHNIQUE_CACHE_KEY, currentTechnique?.slug ?? "practice_test");
      } catch {
        if (active) {
          setIsPomodoroMode(cachedTechnique === "pomodoro");
        }
      }
    };

    void resolveTechnique();

    const handleTechniqueChange = (event: Event) => {
      const detail = (event as CustomEvent<{ technique: StudyTechnique }>).detail;
      const nextTechnique = detail?.technique;
      setIsPomodoroMode(nextTechnique === "pomodoro");
      if (nextTechnique) {
        window.localStorage.setItem(TECHNIQUE_CACHE_KEY, nextTechnique);
      }
    };

    window.addEventListener("study-technique-changed", handleTechniqueChange as EventListener);
    window.addEventListener("focus", resolveTechnique);

    return () => {
      active = false;
      window.removeEventListener("study-technique-changed", handleTechniqueChange as EventListener);
      window.removeEventListener("focus", resolveTechnique);
    };
  }, [loading, userId, userRole]);

  React.useEffect(() => {
    if (!state.isRunning || !state.endsAt) {
      return;
    }

    const timer = window.setInterval(() => {
      const remainingSeconds = Math.max(0, Math.ceil(((state.endsAt ?? Date.now()) - Date.now()) / 1000));
      setState((current) => {
        if (!current.isRunning || !current.endsAt) {
          return current;
        }

        if (remainingSeconds > 0) {
          return {
            ...current,
            secondsLeft: remainingSeconds
          };
        }

        playPomodoroRingtone();
        return getNextPomodoroState(current);
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [state.endsAt, state.isRunning]);

  if (!isPomodoroMode || userRole !== "student") {
    return null;
  }

  const minutes = Math.floor(state.secondsLeft / 60).toString().padStart(2, "0");
  const seconds = (state.secondsLeft % 60).toString().padStart(2, "0");

  async function primeAudio() {
    if (audioPrimedRef.current || typeof window === "undefined") {
      return;
    }

    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return;
      }

      const context = new AudioContextCtor();
      if (context.state === "suspended") {
        await context.resume();
      }
      await context.close();
      audioPrimedRef.current = true;
    } catch {
      // Ignore priming failures. The ringtone helper will still try again later.
    }
  }

  async function toggleRun() {
    await primeAudio();
    setState((current) => {
      if (current.isRunning) {
        return {
          ...current,
          isRunning: false,
          endsAt: null
        };
      }

      return {
        ...current,
        isRunning: true,
        endsAt: Date.now() + current.secondsLeft * 1000
      };
    });
  }

  function resetTimer() {
    setState((current) => ({
      ...current,
      phase: "focus",
      secondsLeft: getPomodoroSecondsForPhase("focus"),
      isRunning: false,
      endsAt: null,
      roundsCompleted: 0
    }));
  }

  function switchPhase() {
    setState((current) => {
      const nextPhase: PomodoroPhase = current.phase === "focus" ? "break" : "focus";
      return {
        ...current,
        phase: nextPhase,
        secondsLeft: getPomodoroSecondsForPhase(nextPhase),
        isRunning: false,
        endsAt: null
      };
    });
  }

  if (isMobileView) {
    return (
      <div className="fixed left-4 right-4 top-4 z-50">
        <div className="flex items-center justify-between rounded-full border border-primary/20 bg-card/95 px-4 py-2 text-sm text-card-foreground shadow-soft backdrop-blur">
          <div className="flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-primary" />
            <span className="font-medium">
              Pomodoro {state.isRunning ? "running" : "paused"}: {state.phase === "focus" ? "Focus" : "Break"}
            </span>
          </div>
          <span className="font-semibold">{minutes}:{seconds}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-[28px] border border-primary/20 bg-card/95 p-4 text-card-foreground shadow-soft backdrop-blur",
        state.phase === "break" ? "border-amber-400/30" : "border-emerald-500/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pomodoro mode</p>
          <p className="mt-1 text-lg font-semibold">{state.phase === "focus" ? "Focus time" : "Break time"}</p>
        </div>
        <button
          type="button"
          onClick={() => setState((current) => ({ ...current, minimized: !current.minimized }))}
          className="rounded-xl border p-2 text-muted-foreground"
          aria-label={state.minimized ? "Expand pomodoro timer" : "Minimize pomodoro timer"}
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      </div>

      {!state.minimized ? (
        <>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3">
            <div>
              <p className="text-4xl font-bold">{minutes}:{seconds}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {state.roundsCompleted} focus round{state.roundsCompleted === 1 ? "" : "s"} completed
              </p>
            </div>
            <div className="rounded-full bg-background px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {state.phase}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Button onClick={() => void toggleRun()}>
              {state.isRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {state.isRunning ? "Pause" : "Start"}
            </Button>
            <Button variant="outline" onClick={switchPhase}>
              <Coffee className="mr-2 h-4 w-4" />
              Switch
            </Button>
            <Button variant="secondary" onClick={resetTimer}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0" />
            A ringtone plays when focus time ends and again when break time ends.
          </div>
        </>
      ) : (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock3 className="h-4 w-4" />
            {state.phase === "focus" ? "Focus" : "Break"}
          </div>
          <p className="text-lg font-semibold">{minutes}:{seconds}</p>
        </div>
      )}
    </div>
  );
}
