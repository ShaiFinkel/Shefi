// One-time-dismissable banner that walks iOS users through "Add to Home
// Screen", since iOS Safari does not show a native install prompt the way
// Chrome on Android does.

import { useEffect, useState } from "react";

const DISMISS_KEY = "shefi_pwa_install_dismissed";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPhone, iPad, iPod (and iPadOS that masquerades as MacIntel with touch)
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (ua.includes("Mac") && "ontouchend" in document)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS-specific
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS()) return;
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    // Wait a beat so it doesn't slap the user the moment they land.
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="fixed bottom-4 inset-x-4 z-40 sm:max-w-sm sm:left-auto sm:right-4">
      <div className="bg-panel border border-accent/40 rounded-2xl shadow-2xl p-4 flex gap-3 items-start">
        <div className="text-2xl shrink-0">📲</div>
        <div className="flex-1 text-sm">
          <div className="font-semibold mb-1">התקיני כאפליקציה</div>
          <p className="text-xs text-ink2 leading-relaxed">
            לחצי על כפתור השיתוף{" "}
            <span className="inline-block bg-bg border border-panel2 rounded px-1.5">
              ⎙
            </span>{" "}
            ובחרי <strong>"הוסף למסך הבית"</strong>.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="סגירה"
          className="text-ink2 hover:text-ink text-xl leading-none -mt-1"
        >
          ×
        </button>
      </div>
    </div>
  );
}
