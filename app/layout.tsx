import type { Metadata, Viewport } from "next";
import "./globals.css";
import ResumeToast from "../components/ResumeToast";
import WelcomeOnboarding from "../components/WelcomeOnboarding";

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr" suppressHydrationWarning><body>{children}<ResumeToast/><WelcomeOnboarding/></body></html>;
}
