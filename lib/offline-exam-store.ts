"use client";

import type { AttemptResult, ReviewQuestion } from "@/lib/types";

const DB_NAME = "psycend-offline-study";
const DB_VERSION = 3;
const FLASHCARD_STORE = "flashcard_decks";
const EXAM_PACK_STORE = "exam_packs";
const OFFLINE_RESULT_STORE = "offline_results";
const QUEUED_ATTEMPT_STORE = "queued_attempts";
const REVIEWER_STORE = "reviewer_files";

export type OfflineExamPack = {
  id: string;
  examId: string;
  sourceExamId: string;
  title: string;
  subject: string;
  chapter: string | null;
  topic: string | null;
  questions: ReviewQuestion[];
  savedAt: string;
};

export type QueuedAttempt = {
  id: string;
  userId: string;
  mockExamId: string;
  answers: { questionId: string; selectedChoice: "A" | "B" | "C" | "D" }[];
  createdAt: string;
  mode: "mock" | "quiz";
  syncedAt: string | null;
  serverAttemptId: string | null;
};

export type OfflineAttemptResult = AttemptResult & {
  id: string;
  examTitle: string;
  subject: string;
  mode: "mock" | "quiz";
  submittedAt: string;
  queuedForSync: boolean;
  serverAttemptId: string | null;
};

export type OfflineReviewerFile = {
  id: string;
  materialId: string;
  title: string;
  subject: string;
  topic: string;
  fileName: string;
  blob: Blob;
  savedAt: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(FLASHCARD_STORE)) {
        database.createObjectStore(FLASHCARD_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(EXAM_PACK_STORE)) {
        database.createObjectStore(EXAM_PACK_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(OFFLINE_RESULT_STORE)) {
        database.createObjectStore(OFFLINE_RESULT_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(QUEUED_ATTEMPT_STORE)) {
        database.createObjectStore(QUEUED_ATTEMPT_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(REVIEWER_STORE)) {
        database.createObjectStore(REVIEWER_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open offline study database."));
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    action(store, resolve, reject);
    transaction.onerror = () => reject(transaction.error ?? new Error(`IndexedDB transaction failed for ${storeName}.`));
  });
}

export async function saveExamPack(pack: OfflineExamPack) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  await withStore<void>(EXAM_PACK_STORE, "readwrite", (store, resolve) => {
    store.put(pack);
    resolve();
  });
}

export async function listExamPacks(): Promise<OfflineExamPack[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return [];
  }

  return withStore<OfflineExamPack[]>(EXAM_PACK_STORE, "readonly", (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as OfflineExamPack[] | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Failed to read offline exam packs."));
  });
}

export async function loadExamPack(examId: string): Promise<OfflineExamPack | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  return withStore<OfflineExamPack | null>(EXAM_PACK_STORE, "readonly", (store, resolve, reject) => {
    const request = store.get(`exam-pack:${examId}`);
    request.onsuccess = () => resolve((request.result as OfflineExamPack | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to load offline exam pack."));
  });
}

export async function queueOfflineAttempt(attempt: QueuedAttempt) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  await withStore<void>(QUEUED_ATTEMPT_STORE, "readwrite", (store, resolve) => {
    store.put(attempt);
    resolve();
  });
}

export async function listQueuedAttempts(userId?: string): Promise<QueuedAttempt[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return [];
  }

  const attempts = await withStore<QueuedAttempt[]>(QUEUED_ATTEMPT_STORE, "readonly", (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as QueuedAttempt[] | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Failed to read queued attempts."));
  });

  return userId ? attempts.filter((attempt) => attempt.userId === userId) : attempts;
}

export async function markQueuedAttemptSynced(localAttemptId: string, serverAttemptId: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  const current = await withStore<QueuedAttempt | null>(QUEUED_ATTEMPT_STORE, "readonly", (store, resolve, reject) => {
    const request = store.get(localAttemptId);
    request.onsuccess = () => resolve((request.result as QueuedAttempt | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to load queued attempt."));
  });

  if (!current) {
    return;
  }

  await withStore<void>(QUEUED_ATTEMPT_STORE, "readwrite", (store, resolve) => {
    store.put({
      ...current,
      syncedAt: new Date().toISOString(),
      serverAttemptId
    });
    resolve();
  });

  const offlineResult = await loadOfflineResult(localAttemptId);
  if (offlineResult) {
    await saveOfflineResult({
      ...offlineResult,
      queuedForSync: false,
      serverAttemptId
    });
  }
}

export async function saveOfflineResult(result: OfflineAttemptResult) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  await withStore<void>(OFFLINE_RESULT_STORE, "readwrite", (store, resolve) => {
    store.put(result);
    resolve();
  });
}

export async function loadOfflineResult(resultId: string): Promise<OfflineAttemptResult | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  return withStore<OfflineAttemptResult | null>(OFFLINE_RESULT_STORE, "readonly", (store, resolve, reject) => {
    const request = store.get(resultId);
    request.onsuccess = () => resolve((request.result as OfflineAttemptResult | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to load offline result."));
  });
}

export function buildOfflineResult({
  attemptId,
  examTitle,
  subject,
  mode,
  questions,
  answers
}: {
  attemptId: string;
  examTitle: string;
  subject: string;
  mode: "mock" | "quiz";
  questions: ReviewQuestion[];
  answers: Record<string, "A" | "B" | "C" | "D">;
}): OfflineAttemptResult {
  const items = questions.map((question) => {
    const correctChoice = question.choices.find((choice) => choice.is_correct)?.choice_key ?? "A";
    const selectedChoice = answers[question.id] ?? null;
    return {
      questionId: question.id,
      questionText: question.question_text,
      explanation: question.explanation,
      topic: question.topic,
      subject: question.subject,
      selectedChoice,
      correctChoice,
      isCorrect: selectedChoice === correctChoice,
      choices: question.choices
    };
  });

  const correctCount = items.filter((item) => item.isCorrect).length;
  const totalItems = items.length;
  const score = totalItems > 0 ? Math.round((correctCount / totalItems) * 10000) / 100 : 0;
  const weakTopics = Array.from(new Set(items.filter((item) => !item.isCorrect).map((item) => item.topic)));

  return {
    id: attemptId,
    examTitle,
    subject,
    mode,
    submittedAt: new Date().toISOString(),
    queuedForSync: true,
    serverAttemptId: null,
    score,
    totalItems,
    correctCount,
    weakTopics,
    items
  };
}

export async function saveOfflineReviewerFile(file: OfflineReviewerFile) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  await withStore<void>(REVIEWER_STORE, "readwrite", (store, resolve) => {
    store.put(file);
    resolve();
  });
}

export async function loadOfflineReviewerFile(materialId: string): Promise<OfflineReviewerFile | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  return withStore<OfflineReviewerFile | null>(REVIEWER_STORE, "readonly", (store, resolve, reject) => {
    const request = store.get(`reviewer:${materialId}`);
    request.onsuccess = () => resolve((request.result as OfflineReviewerFile | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to load offline reviewer file."));
  });
}

export async function listOfflineReviewerFiles(): Promise<OfflineReviewerFile[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return [];
  }

  return withStore<OfflineReviewerFile[]>(REVIEWER_STORE, "readonly", (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as OfflineReviewerFile[] | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Failed to list offline reviewer files."));
  });
}
