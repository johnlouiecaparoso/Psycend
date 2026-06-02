"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { listQueuedAttempts, markQueuedAttemptSynced } from "@/lib/offline-exam-store";

const SHARED_OFFLINE_ROUTES = [
  "/",
  "/offline",
  "/profile",
  "/settings"
];

const STUDENT_OFFLINE_ROUTES = [
  ...SHARED_OFFLINE_ROUTES,
  "/student",
  "/student/flashcards",
  "/student/mock-exams",
  "/student/quiz",
  "/student/reviewers",
  "/student/offline-study",
  "/student/results/offline"
];

const ADMIN_OFFLINE_ROUTES = [
  ...SHARED_OFFLINE_ROUTES,
  "/admin",
  "/admin/imports/exams",
  "/admin/imports/quizzes",
  "/admin/imports/flashcards",
  "/admin/question-bank",
  "/admin/reviewers"
];

const WARMED_ROUTES_KEY = "psycend-offline-warmed";

export function OfflineSupport() {
  const { userId, userRole, loading } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("storage" in navigator && "persist" in navigator.storage) {
      void navigator.storage.persist().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || loading || !userId || !userRole) {
      return;
    }

    const warmedKey = `${WARMED_ROUTES_KEY}:${userId}`;
    if (window.localStorage.getItem(warmedKey) === "true") {
      return;
    }

    const routesToWarm = userRole === "admin" ? ADMIN_OFFLINE_ROUTES : STUDENT_OFFLINE_ROUTES;
    let cancelled = false;

    const warmRoutes = async () => {
      if (!window.navigator.onLine) {
        return;
      }

      try {
        for (const route of routesToWarm) {
          if (cancelled) {
            break;
          }

          await fetch(route, {
            credentials: "include",
            headers: {
              Accept: "text/html"
            }
          }).catch(() => undefined);

          await new Promise((resolve) => {
            window.setTimeout(resolve, 120);
          });
        }

        if (!cancelled) {
          window.localStorage.setItem(warmedKey, "true");
        }
      } catch {
        // Ignore warmup failures. The service worker will still cache pages as the user visits them.
      }
    };

    if ("requestIdleCallback" in window) {
      const idleCallbackId = window.requestIdleCallback(
        () => {
          void warmRoutes();
        },
        { timeout: 4000 }
      );

      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleCallbackId);
      };
    }

    void warmRoutes();

    return () => {
      cancelled = true;
    };
  }, [loading, userId, userRole]);

  useEffect(() => {
    if (typeof window === "undefined" || loading || userRole !== "student" || !userId) {
      return;
    }

    const syncQueuedAttempts = async () => {
      if (!window.navigator.onLine) {
        return;
      }

      const queuedAttempts = await listQueuedAttempts(userId);
      const pendingAttempts = queuedAttempts.filter((attempt) => !attempt.syncedAt);

      await Promise.all(
        pendingAttempts.map(async (attempt) => {
          try {
            const response = await fetch("/api/mock-exams/submit", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                mockExamId: attempt.mockExamId,
                answers: attempt.answers
              })
            });

            const data = (await response.json()) as { attemptId?: string };
            if (response.ok && data.attemptId) {
              await markQueuedAttemptSynced(attempt.id, data.attemptId);
            }
          } catch {
            // Keep the attempt queued for the next reconnect.
          }
        })
      );
    };

    void syncQueuedAttempts();
    window.addEventListener("online", syncQueuedAttempts);

    return () => {
      window.removeEventListener("online", syncQueuedAttempts);
    };
  }, [loading, userId, userRole]);

  return null;
}
