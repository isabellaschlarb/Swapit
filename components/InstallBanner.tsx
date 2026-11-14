"use client";

import { useSyncExternalStore } from "react";
import { AppIcon } from "@/components/Logo";

// "Install Swapit" banner for the feed.
//   Android / Chrome → "Install" button opens the browser's install dialog
//   iPhone / iPad    → tells you to tap Share → Add to Home Screen
//                      (iOS has no install dialog a website can open)
//   Hidden when the app is already installed, after it's dismissed, or on
//   browsers that can't install (e.g. most desktop browsers).

type Mode = "hidden" | "android" | "ios";

// Chrome's install event (not in TypeScript's built-in types yet).
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "swapit-install-banner";
let installEvent: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

// Chrome can fire this very early, so listen as soon as this file loads
// (not after the component mounts) or we might miss it.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // we show our own banner instead of Chrome's mini-bar
    installEvent = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    remember("installed");
  });
}

// localStorage can be unavailable (private mode etc.), so never let it crash.
function remember(value: "dismissed" | "installed") {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
  notify();
}
function wasHidden() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS pretends to be a Mac, but Macs don't have touch screens.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function getMode(): Mode {
  if (isInstalled() || wasHidden()) return "hidden";
  if (installEvent) return "android";
  if (isIOS()) return "ios";
  return "hidden";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function InstallBanner() {
  // On the server we can't know the device, so render nothing there.
  const mode = useSyncExternalStore(subscribe, getMode, () => "hidden" as Mode);
  if (mode === "hidden") return null;

  async function install() {
    if (!installEvent) return;
    const event = installEvent;
    installEvent = null; // the browser only lets us use it once
    await event.prompt();
    const { outcome } = await event.userChoice;
    remember(outcome === "accepted" ? "installed" : "dismissed");
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
      <AppIcon size={44} className="shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-navy">Install Swapit</p>
        {mode === "ios" ? (
          <p className="text-xs leading-snug text-ink/70">
            {/* "Add to Home Screen" stays on one line */}
            Tap Share <ShareIcon /> then <span className="whitespace-nowrap font-semibold">Add to Home Screen</span>
          </p>
        ) : (
          <p className="text-xs text-ink/70">Add it to your home screen, like an app.</p>
        )}
      </div>
      {mode === "android" && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={() => remember("dismissed")}
        aria-label="Dismiss"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

// The iOS Share icon (square with an arrow pointing up).
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="inline h-4 w-4 -translate-y-px align-middle text-navy"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="(the Share icon)"
    >
      <path d="M12 3v12M8 7l4-4 4 4M7 11H5v10h14V11h-2" />
    </svg>
  );
}
