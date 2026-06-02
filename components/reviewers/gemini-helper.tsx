"use client";

import * as React from "react";
import { Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

const HISTORY_STORAGE_KEY = "psycend-gemini-chat-history";

function normalizeAssistantText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*/g, "")
    .trim();
}

function createAssistantMessage(content: string): ChatMessage {
  return {
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: "assistant",
    content
  };
}

function createNewThread(welcomeText: string = "Hi. Ask anything and I will help you study."): ChatThread {
  return {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "New chat",
    updatedAt: Date.now(),
    messages: [createAssistantMessage(welcomeText)]
  };
}

export function GeminiHelper() {
  const [question, setQuestion] = React.useState("");
  const [threads, setThreads] = React.useState<ChatThread[]>(() => [createNewThread()]);
  const [activeThreadId, setActiveThreadId] = React.useState<string>(() => threads[0]?.id ?? "");
  const [error, setError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const threadEndRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const activeThread = React.useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
    [threads, activeThreadId]
  );

  const activeMessages = activeThread?.messages ?? [];

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const rawHistory = window.sessionStorage.getItem(HISTORY_STORAGE_KEY);
      if (!rawHistory) {
        return;
      }

      const parsedHistory = JSON.parse(rawHistory) as {
        threads?: ChatThread[];
        activeThreadId?: string;
      };

      if (!Array.isArray(parsedHistory.threads) || parsedHistory.threads.length === 0) {
        return;
      }

      setThreads(parsedHistory.threads);
      setActiveThreadId(parsedHistory.activeThreadId ?? parsedHistory.threads[0].id);
    } catch {
      // Ignore invalid session history.
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || threads.length === 0 || !activeThreadId) {
      return;
    }

    window.sessionStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({ threads, activeThreadId })
    );
  }, [threads, activeThreadId]);

  React.useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages, isLoading]);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
  }, [question]);

  function resetChat() {
    const nextThread = createNewThread("Fresh chat started.");
    setThreads((current) => [nextThread, ...current].slice(0, 12));
    setActiveThreadId(nextThread.id);
    setQuestion("");
    setError("");
  }

  function deleteThread(threadId: string) {
    setThreads((current) => {
      const remaining = current.filter((thread) => thread.id !== threadId);

      if (remaining.length === 0) {
        const fallback = createNewThread();
        setActiveThreadId(fallback.id);
        return [fallback];
      }

      if (activeThreadId === threadId) {
        setActiveThreadId(remaining[0].id);
      }

      return remaining;
    });
    setError("");
  }

  async function handleAsk(nextQuestion?: string) {
    const prompt = (nextQuestion ?? question).trim();
    if (!prompt) {
      setError("Enter a study question first.");
      return;
    }

    if (!activeThread) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user",
      content: prompt
    };

    const nextTitle =
      activeThread.title === "New chat" || activeThread.title === "Fresh chat"
        ? prompt.slice(0, 42)
        : activeThread.title;

    try {
      setIsLoading(true);
      setError("");
      setThreads((current) =>
        current.map((thread) =>
          thread.id === activeThread.id
            ? {
                ...thread,
                title: nextTitle || "Fresh chat",
                updatedAt: Date.now(),
                messages: [...thread.messages, userMessage]
              }
            : thread
        )
      );
      setQuestion("");

      const response = await fetch("/api/ai/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subject: "General Psychology",
          question: prompt
        })
      });

      const data = (await response.json()) as { answer?: string; error?: string };
      const answer = data.answer?.trim();
      if (!response.ok || !answer) {
        throw new Error(data.error ?? "Gemini helper is unavailable right now.");
      }

      setThreads((current) =>
        current
          .map((thread) =>
            thread.id === activeThread.id
              ? {
                  ...thread,
                  updatedAt: Date.now(),
                  messages: [...thread.messages, createAssistantMessage(answer)]
                }
              : thread
          )
          .sort((left, right) => right.updatedAt - left.updatedAt)
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gemini helper is unavailable right now.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Gemini chat</div>

      <section className="rounded-xl border bg-background/60 px-2 py-1.5 sm:px-2.5 sm:py-1.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Chat history</p>
          <Button
            variant="outline"
            size="icon"
            onClick={resetChat}
            disabled={isLoading}
            className="h-6 w-6 shrink-0 rounded-full"
            aria-label="New chat"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5 pr-1">
          {threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                className={`flex items-center rounded-full border pr-0.5 ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveThreadId(thread.id);
                    setError("");
                  }}
                  className="max-w-[150px] truncate rounded-full px-2.5 py-1 text-[11px] text-left transition hover:bg-muted/60"
                  title={thread.title || "Chat"}
                >
                  {thread.title || "Chat"}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteThread(thread.id);
                  }}
                  className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={`Delete chat ${thread.title || "thread"}`}
                  title="Delete chat"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border-2 border-primary/20 bg-card shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-2.5">
          <div className="flex min-h-full flex-col justify-end gap-2">
            {activeMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[94%] rounded-2xl px-2.5 py-2 text-[13px] leading-5 whitespace-pre-wrap sm:max-w-[82%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background text-foreground"
                  }`}
                >
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {message.role === "user" ? "You" : "Gemini"}
                  </div>
                  {message.role === "assistant" ? normalizeAssistantText(message.content) : message.content}
                </div>
              </div>
            ))}

            {isLoading ? (
              <div className="flex justify-start">
                <div className="max-w-[94%] rounded-2xl border bg-background px-3 py-2 text-[13px] sm:max-w-[82%]">
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Gemini
                  </div>
                  <span className="animate-pulse text-muted-foreground">Thinking...</span>
                </div>
              </div>
            ) : null}

            <div ref={threadEndRef} />
          </div>
        </div>

        <div className="border-t p-1.5 sm:p-2">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleAsk();
                }
              }}
              placeholder="Type your message..."
              className="max-h-24 min-h-[34px] w-full resize-none rounded-xl border bg-background px-2.5 py-1.5 text-sm sm:rounded-2xl sm:px-3"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
              onClick={() => void handleAsk()}
              disabled={isLoading}
              aria-label={isLoading ? "Thinking" : "Send message"}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
