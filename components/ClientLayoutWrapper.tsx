"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AssistantWidget from "@/components/AssistantWidget";
import AuthHydrator from "@/components/AuthHydrator";
import ProtectedRoute from "@/components/ProtectedRoute";
import { LanguageProvider } from "@/lib/i18n";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.endsWith("/print");

  useEffect(() => {
    const applyGlobalSettings = () => {
      if (typeof window === "undefined") return;
      const langue = localStorage.getItem("langue") || "fr";
      const theme = localStorage.getItem("theme") || "dark";

      // Apply language and text direction
      document.documentElement.lang = langue;
      document.documentElement.dir = langue === "ar" ? "rtl" : "ltr";

      // Apply light/dark theme class
      if (theme === "light") {
        document.documentElement.classList.add("light-mode");
      } else if (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches) {
        document.documentElement.classList.add("light-mode");
      } else {
        document.documentElement.classList.remove("light-mode");
      }
    };

    applyGlobalSettings();
    window.addEventListener("settingsUpdated", applyGlobalSettings);
    return () => window.removeEventListener("settingsUpdated", applyGlobalSettings);
  }, []);

  return (
    <LanguageProvider>
      {isPublic ? (
        <div className="flex-1 w-full h-screen overflow-y-auto">
          <AuthHydrator />
          <ProtectedRoute>
            {children}
          </ProtectedRoute>
        </div>
      ) : (
        <div className="flex h-screen relative z-10 p-2 sm:p-3 lg:p-4 gap-3 lg:gap-4">
          <Sidebar />
          <main className="flex-1 flex flex-col h-full rounded-2xl bg-slate-950/80 backdrop-blur-2xl border border-slate-800/80 shadow-2xl overflow-hidden relative">
            <Topbar />
            <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar relative z-10 bg-gradient-to-b from-slate-950/50 to-slate-900/30">
              <AuthHydrator />
              <ProtectedRoute>
                {children}
              </ProtectedRoute>
            </div>
          </main>
          <AssistantWidget />
        </div>
      )}
    </LanguageProvider>
  );
}
