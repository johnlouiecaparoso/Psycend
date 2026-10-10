"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { APP_NAME } from "@/lib/constants";
import { POLICY_VERSION } from "@/lib/legal-content";
import { createClient } from "@/lib/supabase/client";

const ACCEPTED_STORAGE_PREFIX = "psycend-policies-accepted";

function getStorageKey(userId: string) {
  return `${ACCEPTED_STORAGE_PREFIX}:${userId}`;
}

function readLocalAcceptance(userId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(getStorageKey(userId));
  } catch {
    return null;
  }
}

/**
 * Shown once, the first time a new account signs in. Acceptance is recorded on the
 * Supabase user (`policies_accepted_version`) so it follows the account across
 * devices, with a localStorage mirror so a slow metadata refresh cannot make the
 * dialog reappear on the next navigation.
 */
export function PolicyConsentDialog() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasAgreed, setHasAgreed] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const supabase = React.useMemo(() => (typeof window === "undefined" ? null : createClient()), []);

  React.useEffect(() => {
    if (loading || !user) {
      setIsOpen(false);
      return;
    }

    const acceptedVersion =
      typeof user.user_metadata?.policies_accepted_version === "string"
        ? user.user_metadata.policies_accepted_version
        : null;

    const hasAccepted =
      acceptedVersion === POLICY_VERSION || readLocalAcceptance(user.id) === POLICY_VERSION;

    setIsOpen(!hasAccepted);
  }, [loading, user]);

  async function handleAccept() {
    if (!user || !supabase) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          policies_accepted_version: POLICY_VERSION,
          policies_accepted_at: new Date().toISOString()
        }
      });

      if (updateError) {
        throw updateError;
      }

      try {
        window.localStorage.setItem(getStorageKey(user.id), POLICY_VERSION);
      } catch {
        // A blocked storage write is fine; the account metadata is the record of truth.
      }

      setIsOpen(false);
      router.refresh();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "We could not save your acceptance. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDecline() {
    if (!supabase) {
      return;
    }

    try {
      await supabase.auth.signOut();
      setIsOpen(false);
      router.push("/");
      router.refresh();
    } catch (signOutError) {
      console.error("Sign out error:", signOutError);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent
        hideCloseButton
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>

        <DialogTitle className="text-xl font-bold sm:text-2xl">Welcome to {APP_NAME}</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">
          Before you start reviewing, please read and accept how we handle your data and what you
          agree to as a member. You will only be asked this once.
        </DialogDescription>

        <div className="mt-5 space-y-3">
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-left transition hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Privacy Policy</span>
              <span className="block text-xs text-muted-foreground">
                What we collect, how analytics are built, and your rights.
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-left transition hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold">User Agreement</span>
              <span className="block text-xs text-muted-foreground">
                Account rules, acceptable use, and study content limits.
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
          <Checkbox
            checked={hasAgreed}
            onCheckedChange={(checked) => setHasAgreed(Boolean(checked))}
            className="mt-0.5 shrink-0"
            aria-label="I have read and agree to the Privacy Policy and User Agreement"
          />
          <span className="min-w-0 leading-relaxed">
            I have read and agree to the{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
              Privacy Policy
            </Link>{" "}
            and the{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
              User Agreement
            </Link>
            .
          </span>
        </label>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => void handleDecline()} disabled={isSaving}>
            Decline and sign out
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => void handleAccept()} disabled={!hasAgreed || isSaving}>
            {isSaving ? "Saving..." : "Agree and continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
