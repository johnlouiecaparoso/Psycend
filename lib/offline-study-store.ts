"use client";

import type { ReviewQuestion } from "@/lib/types";

const DB_NAME = "psycend-offline-study";
const DB_VERSION = 3;
const FLASHCARD_STORE = "flashcard_decks";
const EXAM_PACK_STORE = "exam_packs";
const OFFLINE_RESULT_STORE = "offline_results";
const QUEUED_ATTEMPT_STORE = "queued_attempts";
const REVIEWER_STORE = "reviewer_files";

type FlashcardDeckRecord = {
  id: string;
  userId: string;
  cards: ReviewQuestion[];
  weakTopics: string[];
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

export async function saveFlashcardDeck(userId: string, cards: ReviewQuestion[], weakTopics: string[]) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FLASHCARD_STORE, "readwrite");
    const store = transaction.objectStore(FLASHCARD_STORE);
    const record: FlashcardDeckRecord = {
      id: `flashcards:${userId}`,
      userId,
      cards,
      weakTopics,
      savedAt: new Date().toISOString()
    };

    store.put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Failed to save flashcards offline."));
  });
}

export async function loadFlashcardDeck(userId: string): Promise<FlashcardDeckRecord | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  const database = await openDatabase();

  return new Promise<FlashcardDeckRecord | null>((resolve, reject) => {
    const transaction = database.transaction(FLASHCARD_STORE, "readonly");
    const store = transaction.objectStore(FLASHCARD_STORE);
    const request = store.get(`flashcards:${userId}`);

    request.onsuccess = () => resolve((request.result as FlashcardDeckRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Failed to load offline flashcards."));
  });
}

export async function listFlashcardDecks(): Promise<FlashcardDeckRecord[]> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return [];
  }

  const database = await openDatabase();

  return new Promise<FlashcardDeckRecord[]>((resolve, reject) => {
    const transaction = database.transaction(FLASHCARD_STORE, "readonly");
    const store = transaction.objectStore(FLASHCARD_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result as FlashcardDeckRecord[] | undefined) ?? []);
    request.onerror = () => reject(request.error ?? new Error("Failed to list offline flashcard decks."));
  });
}
