export const FOCUS_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;
export const POMODORO_STORAGE_KEY = "psycend-pomodoro-widget";
export const POMODORO_STATE_EVENT = "pomodoro-state-changed";

export type PomodoroPhase = "focus" | "break";

export type StoredPomodoroState = {
  phase: PomodoroPhase;
  secondsLeft: number;
  isRunning: boolean;
  roundsCompleted: number;
  endsAt: number | null;
  minimized: boolean;
};

export const DEFAULT_POMODORO_STATE: StoredPomodoroState = {
  phase: "focus",
  secondsLeft: FOCUS_SECONDS,
  isRunning: false,
  roundsCompleted: 0,
  endsAt: null,
  minimized: false
};

export function getPomodoroSecondsForPhase(phase: PomodoroPhase) {
  return phase === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
}

export function safeParsePomodoroState(raw: string | null): StoredPomodoroState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredPomodoroState>;
    const phase = parsed.phase === "break" ? "break" : "focus";
    return {
      phase,
      secondsLeft:
        typeof parsed.secondsLeft === "number" ? parsed.secondsLeft : getPomodoroSecondsForPhase(phase),
      isRunning: Boolean(parsed.isRunning),
      roundsCompleted: typeof parsed.roundsCompleted === "number" ? parsed.roundsCompleted : 0,
      endsAt: typeof parsed.endsAt === "number" ? parsed.endsAt : null,
      minimized: Boolean(parsed.minimized)
    };
  } catch {
    return null;
  }
}

export function readPomodoroState(): StoredPomodoroState {
  if (typeof window === "undefined") {
    return DEFAULT_POMODORO_STATE;
  }

  const stored = safeParsePomodoroState(window.localStorage.getItem(POMODORO_STORAGE_KEY));
  if (!stored) {
    return DEFAULT_POMODORO_STATE;
  }

  if (!stored.isRunning || !stored.endsAt) {
    return stored;
  }

  const secondsLeft = Math.max(0, Math.ceil((stored.endsAt - Date.now()) / 1000));
  return {
    ...stored,
    secondsLeft
  };
}

export function writePomodoroState(state: StoredPomodoroState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(POMODORO_STATE_EVENT, { detail: state }));
}

export function getNextPomodoroState(current: StoredPomodoroState) {
  const nextPhase: PomodoroPhase = current.phase === "focus" ? "break" : "focus";
  const nextSeconds = getPomodoroSecondsForPhase(nextPhase);
  return {
    ...current,
    phase: nextPhase,
    secondsLeft: nextSeconds,
    endsAt: Date.now() + nextSeconds * 1000,
    roundsCompleted: current.phase === "focus" ? current.roundsCompleted + 1 : current.roundsCompleted
  };
}

export function playPomodoroRingtone() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const now = context.currentTime;
  const notes = [880, 1174, 1568, 1174];

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * 0.18;
    const end = start + 0.14;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end);
  });

  window.setTimeout(() => {
    void context.close().catch(() => undefined);
  }, 1200);
}
