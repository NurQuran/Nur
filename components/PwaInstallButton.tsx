"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const { language } = useLanguage();
  const label = language === "ar" ? "تثبيت" : language === "en" ? "Install" : "Installer";
  const accessibleLabel = language === "ar" ? "تثبيت تطبيق نُور" : language === "en" ? "Install the Nūr app" : "Installer l’application Nūr";

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(registration => registration.update()).catch(() => undefined);
    }
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!prompt) return null;
  return (
    <button
      className="install-app"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
      aria-label={accessibleLabel}
    >
      <span aria-hidden="true">↓</span><span>{label}</span>
    </button>
  );
}
