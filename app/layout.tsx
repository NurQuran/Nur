import type { Metadata } from "next";
import "./globals.css";
import ResumeToast from "../components/ResumeToast";

export const metadata: Metadata = { title: "Nūr — Le Coran, éclairé", description: "Lire, écouter et méditer le Coran en arabe, français et anglais." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr" suppressHydrationWarning><body>{children}<ResumeToast/></body></html>;
}
