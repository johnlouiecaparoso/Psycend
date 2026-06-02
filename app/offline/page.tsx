"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function OfflinePage() {
  const router = useRouter();
  const [lastRoute, setLastRoute] = useState<string | null>(null);
  const [lastRole, setLastRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedRoute = window.localStorage.getItem("psycend-last-route");
    const storedRole = window.localStorage.getItem("psycend-last-role");
    setLastRoute(storedRoute);
    setLastRole(storedRole);
  }, []);

  const fallbackLabel = useMemo(() => {
    if (lastRole === "admin") {
      return "Open cached admin dashboard";
    }

    if (lastRole === "student") {
      return "Open cached student dashboard";
    }

    return "Open last cached page";
  }, [lastRole]);

  return (
    <main className="container-shell flex min-h-screen items-center justify-center py-10">
      <Card className="w-full max-w-xl rounded-[32px] border bg-white/90 shadow-soft backdrop-blur dark:bg-card/90">
        <CardContent className="space-y-6 p-8 text-center sm:p-10">
          <div className="mx-auto inline-flex rounded-full bg-secondary p-4 text-secondary-foreground">
            <WifiOff className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">You are offline</h1>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Psycend can still open cached study pages in the installed PWA, but live dashboards, uploads, and fresh exam data need an internet connection.
            </p>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4 text-left text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Offline-ready features</p>
            <p className="mt-2">Open the installed PWA while online first so your student dashboard, flashcards, quizzes, and mock exam launcher can be cached for offline use.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {lastRoute ? (
              <button
                type="button"
                onClick={() => router.push(lastRoute as any)}
                className={buttonVariants()}
              >
                {fallbackLabel}
              </button>
            ) : null}
            <Link href="/" className={buttonVariants()}>
              Back to home
            </Link>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
