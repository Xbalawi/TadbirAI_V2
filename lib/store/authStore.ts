import { create } from "zustand";

export interface User {
  id: string | number;
  email: string;
  nom: string;
  role: string;
  company?: string;
  emailVerified?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: User, accessToken?: string, refreshToken?: string) => void;
  logout: () => void;
  verifyEmail: () => void;
  setRole: (role: string) => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  login: (user, accessToken = "demo_access_token", refreshToken = "demo_refresh_token") => {
    const updatedUser = {
      ...user,
      emailVerified: user.emailVerified ?? true,
    };
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem("user", JSON.stringify(updatedUser));
    if (typeof document !== 'undefined') {
      document.cookie = `access_token=${accessToken}; path=/; max-age=86400; SameSite=Lax`;
    }
    set({ user: updatedUser, accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    if (typeof document !== 'undefined') {
      document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  verifyEmail: () => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, emailVerified: true };
    localStorage.setItem("user", JSON.stringify(updated));
    set({ user: updated });
  },

  setRole: (newRole: string) => {
    const current = get().user;
    if (!current) return;
    // Preview-only: does NOT persist to localStorage
    // The real role is always sourced from the equipe table on login
    set({ user: { ...current, role: newRole } });
  },

  hydrate: () => {
    const token = localStorage.getItem("access_token");
    const refresh = localStorage.getItem("refresh_token");
    const userStr = localStorage.getItem("user");
    
    if (token === "demo_access_token" || token === "session_token_app") {
      get().logout();
      return;
    }

    // Sync token to cookie if it exists (fixes missing cookies for existing sessions)
    if (token && typeof document !== 'undefined') {
      document.cookie = `access_token=${token}; path=/; max-age=86400; SameSite=Lax`;
    }

    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        const current = get().user;
        if (
          current &&
          current.id === parsed.id &&
          current.email === parsed.email &&
          current.role === parsed.role &&
          current.nom === parsed.nom
        ) {
          return;
        }
        set({
          accessToken: token || null,
          refreshToken: refresh || null,
          user: parsed,
          isAuthenticated: true,
        });
      } catch (e) {
        console.error("Hydration error:", e);
      }
    }
  }
}));