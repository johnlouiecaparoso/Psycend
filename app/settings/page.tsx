"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import type { Role, ThemePreference, UserPreferences } from "@/lib/types";
import { defaultUserPreferences } from "@/lib/types";
import { applyTheme, normalizePreferences } from "@/lib/preferences";

export default function SettingsPage() {
  const { user, userRole, preferences, loading, updatePreferences } = useAuth();
  const [formData, setFormData] = useState<UserPreferences>(defaultUserPreferences);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const shellRole: Role = userRole === "admin" || userRole === "instructor" ? "admin" : "student";

  useEffect(() => {
    setFormData(normalizePreferences(preferences));
  }, [preferences]);

  useEffect(() => {
    applyTheme(formData.theme);
  }, [formData.theme]);

  const supportsNotifications = useMemo(
    () => typeof window !== "undefined" && "Notification" in window,
    []
  );

  const setField = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      let nextPreferences = { ...formData };
      let feedbackMessage: string | null = null;
      let feedbackTone: "success" | "error" = "success";

      if (nextPreferences.push_notifications) {
        if (!supportsNotifications) {
          nextPreferences = { ...nextPreferences, push_notifications: false };
          setField("push_notifications", false);
          feedbackTone = "error";
          feedbackMessage = "This browser does not support push notifications. Other settings were still saved.";
        } else {
          const permission = await Notification.requestPermission();

          if (permission !== "granted") {
            nextPreferences = { ...nextPreferences, push_notifications: false };
            setField("push_notifications", false);
            feedbackTone = "error";
            feedbackMessage = "Notification permission was not granted, so push notifications stayed off.";
          } else {
            new Notification("Psycend notifications enabled", {
              body: "You will now receive browser study reminders on this device when supported."
            });
          }
        }
      }

      await updatePreferences(nextPreferences);
      setMessageTone(feedbackTone);
      setMessage(feedbackMessage ?? "Settings saved successfully.");
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell role={shellRole} title="Settings" description="Loading your settings...">
        <div className="flex h-64 items-center justify-center">
          <p>Loading...</p>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell role={shellRole} title="Settings" description="Please sign in to access your settings">
        <div className="flex h-64 items-center justify-center">
          <p>Please sign in to access your settings</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={shellRole} title="Settings" description="Manage your account preferences, theme behavior, and notifications.">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="email_notifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Save your preference for emailed updates and reminder messages.</p>
              </div>
              <Switch
                id="email_notifications"
                checked={formData.email_notifications}
                onCheckedChange={(checked) => setField("email_notifications", checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="push_notifications">Browser Notifications</Label>
                <p className="text-sm text-muted-foreground">Enable device notifications in supported browsers after permission is granted.</p>
              </div>
              <Switch
                id="push_notifications"
                checked={formData.push_notifications}
                onCheckedChange={(checked) => setField("push_notifications", checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="email_reminders">Email Reminders</Label>
                <p className="text-sm text-muted-foreground">Keep daily study reminders included in your saved notification preferences.</p>
              </div>
              <Switch
                id="email_reminders"
                checked={formData.email_reminders}
                onCheckedChange={(checked) => setField("email_reminders", checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="study_reminders">Study Reminders</Label>
                <p className="text-sm text-muted-foreground">Use reminder preference data for future study reminder features and nudges.</p>
              </div>
              <Switch
                id="study_reminders"
                checked={formData.study_reminders}
                onCheckedChange={(checked) => setField("study_reminders", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="theme">Theme</Label>
              <select
                id="theme"
                value={formData.theme}
                onChange={(event) => setField("theme", event.target.value as ThemePreference)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
              <p className="mt-2 text-sm text-muted-foreground">
                System follows your device automatically and switches between dark and light mode when your OS changes.
              </p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
              Your theme preference now previews immediately and is saved to your account when you press Save Settings.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button onClick={handleSave} size="lg" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {message ? (
          <p className={messageTone === "success" ? "text-sm text-emerald-600" : "text-sm text-rose-600"}>{message}</p>
        ) : null}
      </div>
    </AppShell>
  );
}
