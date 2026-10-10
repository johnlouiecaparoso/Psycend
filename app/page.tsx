"use client";

import Link from "next/link";
import { ArrowRight, BrainCircuit, ChartColumn, FileSpreadsheet } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { SiteFooter } from "@/components/site-footer";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Strict CSV import workflow",
    description: "Preview, validate, normalize answer keys, and log failed rows before saving to Supabase.",
    icon: FileSpreadsheet
  },
  {
    title: "Focused analytics",
    description: "Track weak topics, subject performance, readiness, and historical exam outcomes.",
    icon: ChartColumn
  },
  {
    title: "Exam and flashcard modes",
    description: "Use the same question bank for timed mock exams, mastery drills, and review sessions.",
    icon: BrainCircuit
  }
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="container-shell flex-1 py-8 sm:py-12">
      <section className="rounded-[32px] border bg-card/90 p-8 text-card-foreground shadow-soft backdrop-blur sm:p-12">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground">
              Psychology board exam reviewer
            </p>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Modern review workflows for admins and students.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Build confidence with clean dashboards, strict question imports, mobile-ready mock exams,
              flashcards, analytics, and Supabase-powered access control.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={cn(buttonVariants(), "gap-2")}>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/register" className={buttonVariants({ variant: "outline" })}>
                Create account
              </Link>
              <PwaInstallButton className="gap-2" />
            </div>
          </div>
          <Card className="bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:from-emerald-950/30 dark:via-card dark:to-amber-900/20">
            <CardContent className="space-y-5 p-8">
              <div>
                <p className="text-sm text-muted-foreground">Readiness snapshot</p>
                <p className="mt-2 text-5xl font-bold">82%</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-card p-4">
                  <p className="text-sm text-muted-foreground">Weak topics</p>
                  <p className="mt-2 text-2xl font-bold">4</p>
                </div>
                <div className="rounded-2xl bg-card p-4">
                  <p className="text-sm text-muted-foreground">Upload accuracy</p>
                  <p className="mt-2 text-2xl font-bold">91%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <CardContent className="p-6">
                <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
            );
          })}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

