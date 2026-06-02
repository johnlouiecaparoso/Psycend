"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { StudyTechniqueService } from "@/lib/supabase/study-technique-client";
import type { CurrentStudyTechnique } from "@/lib/supabase/study-technique-types";

const techniqueSections = [
  {
    title: "1. Active Learning Techniques",
    description: "These are the most effective because you actively engage your brain.",
    items: [
      ["Active Recall", "Testing yourself without looking at notes"],
      ["Spaced Repetition", "Reviewing material over increasing intervals"],
      ["Feynman Technique", "Explain the topic in simple terms"],
      ["Self-Questioning", 'Ask “why/how” questions while studying'],
      ["Practice Testing", "Quizzes, flashcards, mock exams"]
    ]
  },
  {
    title: "2. Memory & Retention Techniques",
    description: "Useful for memorizing facts, terms, and concepts.",
    items: [
      ["Mnemonics", "Acronyms, rhymes, associations"],
      ["Chunking", "Breaking info into smaller parts"],
      ["Visualization", "Turning concepts into images"],
      ["Method of Loci", "Memory palace technique"],
      ["Association Technique", "Linking new info to what you know"]
    ]
  },
  {
    title: "3. Note-Taking Techniques",
    description: "Different styles depending on your learning preference.",
    items: [
      ["Cornell Method", "Notes + cues + summary"],
      ["Outline Method", "Structured bullet points"],
      ["Mind Mapping", "Visual diagrams of ideas"],
      ["Charting Method", "Tables for comparisons"],
      ["Sentence Method", "Writing everything line-by-line"]
    ]
  },
  {
    title: "4. Time Management Techniques",
    description: "Helps you study efficiently and avoid burnout.",
    items: [
      ["Pomodoro Technique", "25 min study, 5 min break"],
      ["Time Blocking", "Schedule fixed study periods"],
      ["2-Minute Rule", "Start small tasks immediately"],
      ["Eat the Frog", "Do hardest task first"],
      ["Parkinson's Law", "Set deadlines to stay focused"]
    ]
  },
  {
    title: "5. Review & Reinforcement Techniques",
    description: "Ensures long-term learning.",
    items: [
      ["Daily/Weekly Review", "Revisit content regularly"],
      ["Cumulative Review", "Revisit older topics"],
      ["Interleaving", "Mix different subjects/topics"],
      ["Error Analysis", "Study your mistakes"],
      ["Summarization", "Rewrite concepts in your own words"]
    ]
  },
  {
    title: "6. Collaborative Learning Techniques",
    description: "Learning with others.",
    items: [
      ["Group Study", "Study together in a group"],
      ["Peer Teaching", "Teach another learner"],
      ["Discussion-Based Learning", "Talk through concepts"],
      ["Study Circles", "Small focused learning groups"],
      ["Accountability Partners", "Keep each other on track"]
    ]
  },
  {
    title: "7. Focus & Productivity Techniques",
    description: "Improves concentration while studying.",
    items: [
      ["Deep Work", "No distractions"],
      ["Environment Design", "Clean, quiet study area"],
      ["Digital Detox", "Limit phone use"],
      ["Music for Focus", "Lo-fi or instrumental"],
      ["Goal Setting", "SMART goals"]
    ]
  },
  {
    title: "8. Reading & Understanding Techniques",
    description: "For textbooks and long readings.",
    items: [
      ["SQ3R Method", "Survey, Question, Read, Recite, Review"],
      ["Skimming & Scanning", "Find key information quickly"],
      ["Annotation", "Highlight + notes"],
      ["Close Reading", "Read carefully for detail"],
      ["Previewing Topics", "Look ahead before class"]
    ]
  },
  {
    title: "9. Exam Preparation Techniques",
    description: "For better performance during exams.",
    items: [
      ["Past Papers Practice", "Use previous exam papers"],
      ["Mock Exams", "Timed practice exams"],
      ["Exam Simulation", "Practice under real conditions"],
      ["Prioritization Strategy", "Easy to hard"],
      ["Test-Taking Strategies", "Elimination, guessing wisely"]
    ]
  },
  {
    title: "10. Creative Study Techniques",
    description: "Makes studying less boring and more engaging.",
    items: [
      ["Gamification", "Turn study into a game"],
      ["Drawing & Doodling", "Visualize concepts creatively"],
      ["Storytelling Method", "Turn topics into stories"],
      ["Teaching Through Videos", "Explain concepts on video"],
      ["Using Apps", "Quizlet, Anki, Notion"]
    ]
  },
  {
    title: "11. Lifestyle-Based Techniques",
    description: "These directly affect how well you learn.",
    items: [
      ["Proper Sleep", "7-9 hours"],
      ["Exercise", "Boosts memory"],
      ["Healthy Diet", "Brain foods"],
      ["Hydration", "Keep water intake steady"],
      ["Stress Management", "Meditation, breaks"]
    ]
  }
] as const;

export default function StudentStudyTechniquePage() {
  const { userId, loading: authLoading } = useAuth();
  const [currentTechnique, setCurrentTechnique] = useState<CurrentStudyTechnique | null>(null);
  const [applyingPomodoro, setApplyingPomodoro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || authLoading) {
      return;
    }

    const loadCurrentTechnique = async () => {
      try {
        const studyTechniqueService = new StudyTechniqueService();
        const currentTechniqueData = await studyTechniqueService.getCurrentStudyTechnique(userId);
        setCurrentTechnique(currentTechniqueData);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load study technique status.");
      } finally {
        setLoading(false);
      }
    };

    void loadCurrentTechnique();
  }, [authLoading, userId]);

  async function handleEnablePomodoro() {
    if (!userId) {
      return;
    }

    try {
      setApplyingPomodoro(true);
      const studyTechniqueService = new StudyTechniqueService();
      await studyTechniqueService.applyTechnique("pomodoro");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("psycend-active-study-technique", "pomodoro");
        window.dispatchEvent(new CustomEvent("study-technique-changed", { detail: { technique: "pomodoro" } }));
      }
      const updatedTechnique = await studyTechniqueService.getCurrentStudyTechnique(userId);
      setCurrentTechnique(updatedTechnique);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Failed to enable Pomodoro.");
    } finally {
      setApplyingPomodoro(false);
    }
  }

  async function handleDisablePomodoro() {
    if (!userId) {
      return;
    }

    try {
      setApplyingPomodoro(true);
      const studyTechniqueService = new StudyTechniqueService();
      await studyTechniqueService.clearCurrentTechnique();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("psycend-active-study-technique");
        window.dispatchEvent(new CustomEvent("study-technique-changed", { detail: { technique: "practice_test" } }));
      }
      setCurrentTechnique(null);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Failed to disable Pomodoro.");
    } finally {
      setApplyingPomodoro(false);
    }
  }

  const isPomodoroActive = currentTechnique?.slug === "pomodoro";

  return (
    <AppShell
      role="student"
      title="Study technique"
      description="A simple list of available study techniques. Only Pomodoro remains interactive."
    >
      {loading || authLoading ? (
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Loading study techniques...</div>
      ) : error ? (
        <div className="rounded-2xl border bg-card p-6 text-sm text-rose-600">{error}</div>
      ) : (
        <section className="grid gap-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>Pomodoro Technique</CardTitle>
              <p className="text-sm text-muted-foreground">25 minutes of focused study, then a 5 minute break.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                Status: <span className="font-semibold">{isPomodoroActive ? "Active" : "Inactive"}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleEnablePomodoro} disabled={applyingPomodoro || isPomodoroActive}>
                  {applyingPomodoro && !isPomodoroActive ? "Enabling..." : isPomodoroActive ? "Pomodoro active" : "Enable Pomodoro"}
                </Button>
                <Button variant="outline" onClick={handleDisablePomodoro} disabled={applyingPomodoro || !isPomodoroActive}>
                  Disable Pomodoro
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Pomodoro is the only technique you can activate here. The other techniques below are for reference.
              </p>
            </CardContent>
          </Card>

          <div className="overflow-x-auto">
            <div className="flex gap-4 pb-2 min-w-max">
              {techniqueSections.map((section) => (
                <Card key={section.title} className="h-full flex-shrink-0 w-80">
                  <CardHeader>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {section.items.map(([name, description]) => (
                        <li key={name} className="rounded-xl bg-muted/40 px-3 py-2">
                          <span className="font-semibold">{name}</span>
                          <span className="text-muted-foreground"> — {description}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
