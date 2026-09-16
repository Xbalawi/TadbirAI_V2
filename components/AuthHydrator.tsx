"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { useTenantStore } from "@/lib/store/tenantStore";

export default function AuthHydrator() {
  const hydrate = useAuthStore((s) => s.hydrate);
  
  useEffect(() => { 
    hydrate(); 
    useTenantStore.getState().hydrate();
    useTenantStore.getState().fetchOrganizations();

    // Global fetch interceptor to inject x-organization-id and catch 401s
    if (typeof window !== "undefined") {
      try {
        const originalFetch = window.fetch;
        if (typeof originalFetch === "function") {
          const interceptedFetch = async function (this: any, ...args: any[]) {
            // Auto inject active organization header for /api/ calls
            try {
              const activeOrg = localStorage.getItem("active_organization_id");
              if (activeOrg && args.length > 0) {
                const firstArg = args[0];
                const rawUrl = typeof firstArg === "string" ? firstArg : (firstArg && firstArg.url ? firstArg.url : "");
                if (typeof rawUrl === "string" && (rawUrl.startsWith("/api/") || rawUrl.includes("/api/"))) {
                  const options = args[1] ? { ...args[1] } : {};
                  const existingHeaders = options.headers;
                  if (existingHeaders instanceof Headers) {
                    if (!existingHeaders.has("x-organization-id")) {
                      existingHeaders.set("x-organization-id", activeOrg);
                    }
                  } else if (Array.isArray(existingHeaders)) {
                    const hasOrg = existingHeaders.some(([k]) => k.toLowerCase() === "x-organization-id");
                    if (!hasOrg) {
                      existingHeaders.push(["x-organization-id", activeOrg]);
                    }
                  } else if (typeof existingHeaders === "object" && existingHeaders !== null) {
                    if (!existingHeaders["x-organization-id"]) {
                      options.headers = { ...existingHeaders, "x-organization-id": activeOrg };
                    }
                  } else {
                    options.headers = { "x-organization-id": activeOrg };
                  }
                  args[1] = options;
                }
              }
            } catch (err) {
              // Ignore header injection error
            }

            const response = await originalFetch.apply(this, args);
            if (response && response.status === 401) {
              const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url ? args[0].url : "");
              // Ignore login check routes
              if (url && !url.includes('/api/auth/login') && !url.includes('/api/auth/check-user')) {
                useAuthStore.getState().logout();
                window.location.href = '/login';
              }
            }
            return response;
          };

          try {
            window.fetch = interceptedFetch;
          } catch {
            try {
              Object.defineProperty(window, "fetch", {
                value: interceptedFetch,
                writable: true,
                configurable: true,
              });
            } catch {
              // Environment strictly protects window.fetch as getter-only, ignore
            }
          }
        }
      } catch (err) {
        console.warn("Could not attach fetch interceptor:", err);
      }
    }
    
    // Hydrate theme mode on app load
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme") || "dark";
      if (savedTheme === "light") {
        document.documentElement.classList.add("light-mode");
      } else if (savedTheme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches) {
        document.documentElement.classList.add("light-mode");
      } else {
        document.documentElement.classList.remove("light-mode");
      }
      
      // Fetch and sync global settings from backend to local cache
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const activeOrg = typeof window !== "undefined" ? localStorage.getItem("active_organization_id") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (activeOrg) headers["x-organization-id"] = activeOrg;

      fetch("/api/settings", { headers, cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return null;
          const text = await res.text();
          if (!text) return null;
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        })
        .then((data) => {
          if (!data || typeof data !== "object") return;
          let updated = false;
          if (data.devise && data.devise !== localStorage.getItem("devise")) {
            localStorage.setItem("devise", data.devise);
            updated = true;
          }
          if (data.formatDate && data.formatDate !== localStorage.getItem("formatDate")) {
            localStorage.setItem("formatDate", data.formatDate);
            updated = true;
          }
          if (updated) {
            window.dispatchEvent(new CustomEvent("settingsUpdated"));
          }
        })
        .catch((err) => {
          // Non-blocking warning for offline or unauthenticated startup
          console.warn("Could not sync settings on startup", err);
        });
    }
  }, [hydrate]);

  return null;
}