"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpenText,
  Bot,
  BrainCircuit,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Layers3,
  Lightbulb,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  SquareLibrary,
  User,
  UserRound,
  X
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/auth/user-menu";
import { FloatingPomodoroWidget } from "@/components/study-technique/floating-pomodoro-widget";
import { PwaInstallGuide } from "@/components/pwa-install-guide";
import { createClient } from "@/lib/supabase/client";

const LAST_ROLE_STORAGE_KEY = "psycend-last-role";
const LAST_ROUTE_STORAGE_KEY = "psycend-last-route";

type NavItem = {
  href: Route;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: ShieldCheck },
    { href: "/admin/imports/exams", label: "Exam Imports", icon: FileSpreadsheet },
    { href: "/admin/imports/quizzes", label: "Quiz Imports", icon: Layers3 },
    { href: "/admin/imports/flashcards", label: "Flashcard Imports", icon: Layers3 },
    { href: "/admin/question-bank", label: "Question Bank", icon: Layers3 },
    { href: "/admin/reviewers", label: "Reviewer Library", icon: BookOpenText },
    { href: "/profile", label: "Profile", icon: UserRound }
  ],
  student: [
    { href: "/student", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/mock-exams", label: "Mock Exams", icon: BrainCircuit },
    { href: "/student/quiz", label: "Quick Quiz", icon: Layers3 },
    { href: "/student/flashcards", label: "Flashcards", icon: Layers3 },
    { href: "/student/reviewers", label: "Reviewers", icon: BookOpenText },
    { href: "/student/study-technique", label: "Study Technique", icon: Lightbulb },
    { href: "/student/study-tasks", label: "Study Tasks", icon: ListChecks },
    { href: "/student/subjects", label: "Subjects", icon: SquareLibrary },
    { href: "/student/ai-helper", label: "AI Helper", icon: Bot },
    { href: "/student/offline-downloads", label: "Offline Downloads", icon: Download }
  ]
};

const studentPrimaryNav = [
  "/student",
  "/student/mock-exams",
  "/student/quiz",
  "/student/flashcards",
  "/student/reviewers"
] as const;

function StudentSidebarActions() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => (typeof window === "undefined" ? null : createClient()), []);

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    try {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  const actionClassName = (href: string) =>
    cn(
      "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:rounded-2xl sm:py-3",
      pathname === href ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <div className="w-full self-stretch space-y-2">
      <Link href="/profile" className={actionClassName("/profile")}>
        <User className="h-4 w-4" />
        Profile
      </Link>
      <Link href="/settings" className={actionClassName("/settings")}>
        <Settings className="h-4 w-4" />
        Settings
      </Link>
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:rounded-2xl sm:py-3"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );
}

function AdminSidebarActions() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => (typeof window === "undefined" ? null : createClient()), []);

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    try {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  const actionClassName = (href: string) =>
    cn(
      "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:rounded-2xl sm:py-3",
      pathname === href ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <div className="w-full self-stretch space-y-2">
      <Link href="/settings" className={actionClassName("/settings")}>
        <Settings className="h-4 w-4" />
        Settings
      </Link>
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:rounded-2xl sm:py-3"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </div>
  );
}

export function AppShell({
  role,
  title,
  description: _description,
  children
}: {
  role: Role;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isQuizMode = searchParams.get("mode") === "quiz";

  const isNavItemActive = (href: string) => {
    const isSectionRoot = href === `/${role}` || href === "/admin";

    if (role === "student") {
      const isMockExamDetail = pathname.startsWith("/student/mock-exams/");

      if (href === "/student/quiz" && (pathname === "/student/quiz" || (isMockExamDetail && isQuizMode))) {
        return true;
      }

      if (href === "/student/mock-exams" && isMockExamDetail && isQuizMode) {
        return false;
      }
    }

    return isSectionRoot ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LAST_ROLE_STORAGE_KEY, role);
    window.localStorage.setItem(LAST_ROUTE_STORAGE_KEY, pathname);
  }, [pathname, role]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.navigator.onLine) {
      return;
    }

    const routesToPrefetch: Route[] = [
      ...new Set([
        ...navByRole[role].map((item) => item.href),
        "/profile" as Route,
        "/settings" as Route
      ])
    ];

    const prefetchRoutes = () => {
      routesToPrefetch.forEach((route) => {
        router.prefetch(route);
      });
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchRoutes, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    prefetchRoutes();
  }, [role, router]);

  const sidebar = (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col overflow-y-auto rounded-[22px] border bg-card p-4 text-card-foreground shadow-soft sm:p-5 lg:overflow-y-auto",
        "lg:sticky lg:top-6 lg:block lg:h-[calc(100vh-3rem)] lg:max-h-[calc(100vh-3rem)] lg:self-start lg:rounded-[28px]",
        isSidebarOpen ? "block" : "hidden lg:block"
      )}
    >
      <div className="mb-6 flex shrink-0 items-center justify-between gap-3 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-bold">{APP_NAME}</p>
            <p className="text-sm text-muted-foreground capitalize">{role} portal</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(false)}
          className="rounded-xl border p-2 text-muted-foreground lg:hidden"
          aria-label="Close dashboard menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex flex-1 flex-col">
        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {role === "student" ? (
            <>
              {navByRole.student
                .filter((item) => studentPrimaryNav.includes(item.href as (typeof studentPrimaryNav)[number]))
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href as any}
                      prefetch
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:rounded-2xl sm:py-3",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 break-words">{item.label}</span>
                    </Link>
                  );
                })}
              <div className="mt-2 px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Study tools
              </div>
              {navByRole.student
                .filter((item) => !studentPrimaryNav.includes(item.href as (typeof studentPrimaryNav)[number]))
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href as any}
                      prefetch
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:rounded-2xl sm:py-3",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 break-words">{item.label}</span>
                    </Link>
                  );
                })}
            </>
          ) : (
            navByRole[role].map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  prefetch
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition sm:rounded-2xl sm:py-3",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 break-words">{item.label}</span>
                </Link>
              );
            })
          )}
        </nav>
        <div className="mt-3 shrink-0 border-t pt-3">
          {role === "student" ? <StudentSidebarActions /> : null}
          {role === "admin" ? <AdminSidebarActions /> : null}
        </div>
        <div className="mt-4 w-full shrink-0 self-stretch rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground sm:mt-5">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <UserRound className="h-4 w-4" />
            {role === "student" ? "Study with structure" : "Manage learning content"}
          </div>
          {role === "student"
            ? "Use quizzes, mock exams, flashcards, and reviewer PDFs together to strengthen weak topics."
            : "Keep exam imports strict, reviewer PDFs organized, and analytics clear for every learner."}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      <div className="container-shell py-4 sm:py-6">
        <div className="grid gap-6 lg:items-start lg:grid-cols-[260px_1fr]">
          <div className="hidden lg:block">{sidebar}</div>
          <main className="min-w-0 space-y-5 sm:space-y-6">
            {role === "student" ? <PwaInstallGuide /> : null}
            <div className="rounded-[22px] border bg-card/90 p-4 text-card-foreground shadow-soft backdrop-blur sm:rounded-[28px] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                    className="shrink-0 rounded-2xl border p-3 text-muted-foreground lg:hidden"
                    aria-label="Open dashboard menu"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                  <div className="min-w-0">
                    <h1 className="break-words text-xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                  </div>
                </div>
                {role === "admin" ? null : <UserMenu role={role} />}
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>

      {isSidebarOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden">
          <div className="h-[100dvh] overflow-hidden p-3 sm:p-4">
            <div className="h-full w-[min(17.5rem,calc(100vw-1.5rem))] max-w-full">{sidebar}</div>
          </div>
        </div>
      ) : null}

      {role === "student" ? <FloatingPomodoroWidget /> : null}
    </div>
  );
}
