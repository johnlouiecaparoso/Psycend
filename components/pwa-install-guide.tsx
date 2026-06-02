"use client";

import * as React from "react";
import { Info, Share } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa-install-button";

const DISMISS_KEY = "psychboard-install-guide-dismissed";

export function PwaInstallGuide() {
  const [isIOS, setIsIOS] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsIOS(ios);
    setIsStandalone(standalone);
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  if (dismissed || isStandalone) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-card/90 p-4 text-card-foreground shadow-soft backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            {isIOS ? <Share className="h-5 w-5" /> : <Info className="h-5 w-5" />}
          </div>
          <div className="space-y-2">
            <p className="font-semibold">Install Psycend on your device</p>
            <p className="text-sm text-muted-foreground">
              {isIOS
                ? "On iPhone or iPad, open this app in Safari, tap Share, then choose Add to Home Screen."
                : "Install the PWA so students can launch Psycend from the home screen and keep using cached study tools offline."}
            </p>
            {!isIOS ? <PwaInstallButton className="gap-2" /> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "true");
            setDismissed(true);
          }}
          className="text-sm text-muted-foreground"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
