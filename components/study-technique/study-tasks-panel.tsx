"use client";

import * as React from "react";
import { Brain, CheckCircle2, Clock3, ListChecks, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurrentStudyTechnique } from "@/lib/supabase/study-technique-types";
import { buildTechniqueTasks } from "@/lib/study-techniques";
import type { StudyTechnique } from "@/lib/types";

type EditableStudyTask = {
  id: string;
  text: string;
  completed: boolean;
};

function buildTaskStorageKey(dateKey: string) {
  return `psycend-study-tasks:${dateKey}`;
}

export function StudyTasksPanel({
  currentTechnique,
  weakTopicNames,
  availableExams
}: {
  currentTechnique: CurrentStudyTechnique | null;
  weakTopicNames: string[];
  availableExams: number;
}) {
  const activeSlug = (currentTechnique?.slug ?? "practice_test") as StudyTechnique;
  const tasks = buildTechniqueTasks(activeSlug, weakTopicNames);
  const todayKey = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [customTasks, setCustomTasks] = React.useState<EditableStudyTask[]>([]);
  const [newTask, setNewTask] = React.useState("");

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(buildTaskStorageKey(todayKey));
      if (!raw) {
        setCustomTasks([]);
        return;
      }

      const parsed = JSON.parse(raw) as EditableStudyTask[];
      setCustomTasks(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCustomTasks([]);
    }
  }, [todayKey]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(buildTaskStorageKey(todayKey), JSON.stringify(customTasks));
  }, [customTasks, todayKey]);

  function addCustomTask() {
    const trimmedTask = newTask.trim();
    if (!trimmedTask) {
      return;
    }

    setCustomTasks((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        text: trimmedTask,
        completed: false
      }
    ]);
    setNewTask("");
  }

  function toggleCustomTask(taskId: string) {
    setCustomTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task))
    );
  }

  function removeCustomTask(taskId: string) {
    setCustomTasks((current) => current.filter((task) => task.id !== taskId));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s study tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              {currentTechnique?.dashboard_task_label ?? "Recommended review tasks"}
            </div>
            <p className="mt-2 text-2xl font-bold">
              {activeSlug === "practice_test" ? availableExams : Math.max(weakTopicNames.length, 1)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4" />
              Weak areas detected
            </div>
            <p className="mt-2 text-2xl font-bold">{weakTopicNames.length}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {tasks.map((task) => (
            <div key={task} className="flex items-start gap-3 rounded-2xl bg-muted/20 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{task}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border bg-muted/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomTask();
                }
              }}
              placeholder="Add your own task for today"
              className="h-11 w-full rounded-2xl border bg-background px-4 py-2 text-sm"
            />
            <Button className="w-full sm:w-auto" onClick={addCustomTask}>
              <Plus className="mr-2 h-4 w-4" />
              Add task
            </Button>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            {customTasks.length === 0 ? (
              <p className="text-muted-foreground">No custom tasks yet. Add what you want to finish today.</p>
            ) : (
              customTasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between gap-3 rounded-2xl bg-background/80 p-3">
                  <button
                    type="button"
                    onClick={() => toggleCustomTask(task.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${task.completed ? "text-emerald-500" : "text-muted-foreground"}`} />
                    <span className={task.completed ? "text-muted-foreground line-through" : ""}>{task.text}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCustomTask(task.id)}
                    className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          Switching study mode does not erase your progress. It changes how your next review session is guided.
        </div>
      </CardContent>
    </Card>
  );
}
