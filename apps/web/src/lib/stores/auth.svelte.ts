/**
 * P2-HTTPONLY-COOKIES: Auth store now works with httpOnly cookies.
 * Access tokens are stored in secure httpOnly cookies by the server.
 * Frontend no longer stores tokens in localStorage (XSS attack surface reduced).
 */

import { api } from "$lib/api/client";

interface AuthState {
  user: { id: string; email: string; name: string; role: string } | null;
  loading: boolean;
}

let state = $state<AuthState>({
  user: null,
  loading: true,
});

// Restore user info from localStorage only (no tokens stored client-side anymore)
if (typeof window !== "undefined") {
  const storedUser = localStorage.getItem("polis_user");
  if (storedUser) {
    try {
      state.user = JSON.parse(storedUser);
      // Tokens are in httpOnly cookies, no need to set them here
    } catch {}
  }
  state.loading = false;
}

function persistUser() {
  if (typeof window !== "undefined" && state.user) {
    localStorage.setItem("polis_user", JSON.stringify(state.user));
  }
}

export async function login(email: string, password: string) {
  const result = await api.login(email, password);
  state.user = result.user;
  // Access token is now in httpOnly cookie, no need to store in state
  persistUser();
}

export async function register(email: string, password: string, name: string) {
  const result = await api.register(email, password, name);
  state.user = result.user;
  // Access token is now in httpOnly cookie, no need to store in state
  persistUser();
}

export function logout() {
  api.logout().catch(() => {});
  state.user = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("polis_user");
    // Cookies are cleared by server's Set-Cookie header with Max-Age=0
  }
}

export function getAuth() {
  return state;
}
