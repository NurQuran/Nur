"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "./AccountProvider";
import { useLanguage } from "../lib/i18n";
import { clientEntryAllowed, protectedPage } from "../lib/appEntry";

export default function EntryGate({ children }: { children: ReactNode }) {
  const pathname = usePathname(), { user, ready, guestAuthorized } = useAccount(), { t } = useLanguage();
  const [allowed, setAllowed] = useState(false);
  const restricted = protectedPage(pathname);
  useEffect(() => {
    if (!restricted || !ready) { setAllowed(false); return; }
    if ((user || guestAuthorized) && clientEntryAllowed(!!user, localStorage.getItem("nur-onboarding-complete"), localStorage.getItem("nur-guest"))) {
      setAllowed(true); return;
    }
    setAllowed(false);
    sessionStorage.setItem("nur-auth-return-to", location.pathname + location.search + location.hash);
    location.replace(`/welcome?${user ? "" : "login=1&"}next=${encodeURIComponent(location.pathname + location.search + location.hash)}`);
  }, [pathname, restricted, ready, user, guestAuthorized]);
  if (!restricted) return children;
  // Do not mount the reader/chat (or start its requests) until access is resolved.
  return allowed && ready && (user || guestAuthorized) ? children : <main className="entry-loading" aria-busy="true" aria-label={t("loading")}/>;
}
