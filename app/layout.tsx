import type { Metadata, Viewport } from "next";
import "./globals.css";
import ResumeToast from "../components/ResumeToast";
import WelcomeOnboarding from "../components/WelcomeOnboarding";
import AppRuntime from "../components/AppRuntime";

export const metadata: Metadata = {
  title: "Nūr — Le Coran, éclairé",
  description: "Lire, écouter et méditer le Coran en arabe, français et anglais.",
  manifest: "/manifest.webmanifest",
  applicationName: "Nūr",
  icons: {
    icon: [
      { url: "/icons/nur-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/nur-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/nur-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
  colorScheme: "dark light",
  viewportFit: "cover",
};

const androidBootstrap=`try{var raw=window.NurAndroid&&window.NurAndroid.getState&&window.NurAndroid.getState();var shared=raw?JSON.parse(raw):null;if(shared){if(shared.theme)localStorage.setItem('nur-theme',shared.theme);if(shared.language)localStorage.setItem('nur-language',shared.language);if(shared.onboarded)localStorage.setItem('nur-onboarding-complete','1')}var theme=(shared&&shared.theme)||localStorage.getItem('nur-theme')||'dark';document.documentElement.setAttribute('data-theme',theme)}catch(e){document.documentElement.setAttribute('data-theme','dark')}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:androidBootstrap}}/></head><body>{children}<AppRuntime/><ResumeToast/><WelcomeOnboarding/></body></html>;
}
