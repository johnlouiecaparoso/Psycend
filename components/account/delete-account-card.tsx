"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const CONFIRM_PHRASE = "DELETE";

export function DeleteAccountCard({ isStudent }: { isStudent: boolean }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => (typeof window === "undefined" ? null : createClient()), []);

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  async function handleDelete() {
    if (!canConfirm) {
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);

      const response = await fetch("/api/account", { method: "DELETE" });
      const data = (await response.json()) as { deleted?: boolean; error?: string };

      if (!response.ok || !data.deleted) {
        throw new Error(data.error ?? "Failed to delete your account.");
      }

      // The account is gone; clear the local session and anything cached on device.
      try {
        await supabase?.auth.signOut();
      } catch {
        // The session is already invalid server-side, so a failure here is harmless.
      }

      try {
        window.localStorage.clear();
      } catch {
        // Ignore storage failures.
      }

      router.push("/");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete your account.");
      setIsDeleting(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          Delete account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Permanently deletes your account and everything attached to it: your profile, every exam and
          quiz attempt, your answers, analytics, and study sessions. This cannot be undone.
        </p>

        {isStudent ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 sm:w-auto">
                Delete my account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
              <DialogTitle className="text-xl font-semibold text-destructive">Delete your account?</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-muted-foreground">
                This permanently removes your profile, all exam and quiz attempts, your answers and
                analytics, and your study sessions. It cannot be undone and your history cannot be
                restored.
              </DialogDescription>

              <div className="mt-5 space-y-2">
                <Label htmlFor="confirm-delete">
                  Type <span className="font-semibold text-foreground">{CONFIRM_PHRASE}</span> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  autoComplete="off"
                  placeholder={CONFIRM_PHRASE}
                />
              </div>

              {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <DialogClose asChild>
                  <Button variant="outline" className="w-full sm:w-auto" disabled={isDeleting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
                  onClick={() => void handleDelete()}
                  disabled={!canConfirm || isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Permanently delete"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <p className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
            Admin and instructor accounts own imported questions and reviewer files, so they cannot be
            deleted from here. Contact support to have your account closed and your content reassigned.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
