/**
 * Type-safe API client for POLIS backend.
 * P2-CSRF-PROTECTION: Automatically includes CSRF token in X-CSRF-Token header.
 * P2-HTTPONLY-COOKIES: Cookies are sent automatically by the browser (no manual token handling).
 */

const BASE = "/api/v1";

interface ApiError {
  error: { code: string; message: string };
}

class ApiClient {
  private csrfToken: string | null = null;

  async ensureCsrfToken() {
    if (!this.csrfToken) {
      try {
        const res = await fetch(`${BASE}/csrf/token`);
        const json = (await res.json()) as any;
        this.csrfToken = json.data?.token || null;
      } catch (e) {
        console.warn("[api] Failed to fetch CSRF token:", e);
      }
    }
    return this.csrfToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // P2-CSRF-PROTECTION: Include CSRF token for state-changing requests
    if (["POST", "PATCH", "DELETE", "PUT"].includes(method)) {
      const csrfToken = await this.ensureCsrfToken();
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    }

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // P2-HTTPONLY-COOKIES: Credentials needed to send httpOnly cookies
      credentials: "include",
    });

    const json = await res.json();

    if (!res.ok) {
      const err = json as ApiError;
      throw new Error(err.error?.message ?? `API error ${res.status}`);
    }

    return (json as { data: T }).data;
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{
      user: { id: string; email: string; name: string; role: string };
      accessToken: string;
      refreshToken: string;
    }>("POST", "/auth/login", { email, password });
  }

  async register(email: string, password: string, name: string) {
    return this.request<{
      user: { id: string; email: string; name: string; role: string };
      accessToken: string;
      refreshToken: string;
    }>("POST", "/auth/register", { email, password, name });
  }

  async refresh(refreshToken?: string) {
    return this.request<{ accessToken: string; refreshToken: string }>(
      "POST",
      "/auth/refresh",
      { refreshToken }
    );
  }

  async logout(refreshToken?: string) {
    return this.request<{ message: string }>("POST", "/auth/logout", {
      refreshToken,
    });
  }

  // Orgs
  async listMyOrgs() {
    return this.request<{ id: string; name: string; slug: string; type: string; status: string; role: string }[]>("GET", "/me/orgs");
  }

  async getOrg(id: string) {
    return this.request<any>("GET", `/orgs/${id}`);
  }

  async getOrgStats(id: string) {
    return this.request<{
      members: number;
      proposals: number;
      openProposals: number;
      treasuryBalance: number;
      reserveBalance: number;
      cycleNumber: number;
    }>("GET", `/orgs/${id}/stats`);
  }

  // Members
  async listMembers(orgId: string) {
    return this.request<any[]>("GET", `/orgs/${orgId}/members`);
  }

  async addMember(orgId: string, data: { name: string; email?: string; role?: string }) {
    return this.request<any>("POST", `/orgs/${orgId}/members`, data);
  }

  async getMember(orgId: string, memberId: string) {
    return this.request<any>("GET", `/orgs/${orgId}/members/${memberId}`);
  }

  // Proposals
  async listProposals(orgId: string, filters?: { status?: string; type?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.type) params.set("type", filters.type);
    const qs = params.toString();
    return this.request<any[]>("GET", `/orgs/${orgId}/proposals${qs ? `?${qs}` : ""}`);
  }

  async createProposal(orgId: string, data: { type: string; title: string; body: string }) {
    return this.request<any>("POST", `/orgs/${orgId}/proposals`, data);
  }

  async getProposal(orgId: string, proposalId: string) {
    return this.request<any>("GET", `/orgs/${orgId}/proposals/${proposalId}`);
  }

  async castVote(orgId: string, proposalId: string, vote: "yea" | "nay" | "abstain", reason?: string) {
    return this.request<any>("POST", `/orgs/${orgId}/proposals/${proposalId}/vote`, { vote, reason });
  }

  async getVotes(orgId: string, proposalId: string) {
    return this.request<any[]>("GET", `/orgs/${orgId}/proposals/${proposalId}/votes`);
  }

  // Treasury
  async getTreasury(orgId: string) {
    return this.request<{
      balance: number;
      reserveBalance: number;
      poolBalance: number;
      currency: string;
      cycleNumber: number;
      nextPayoutAt: string | null;
    }>("GET", `/orgs/${orgId}/treasury`);
  }

  async getLedger(orgId: string, limit = 50, offset = 0) {
    return this.request<any[]>("GET", `/orgs/${orgId}/ledger?limit=${limit}&offset=${offset}`);
  }

  // Constitution
  async getConstitution(orgId: string) {
    return this.request<any>("GET", `/orgs/${orgId}/constitution`);
  }

  async getLaws(orgId: string) {
    return this.request<any[]>("GET", `/orgs/${orgId}/laws`);
  }

  // SAR Log
  async listSarLog(orgId: string, limit = 50, offset = 0, filters?: { task?: string; status?: string }) {
    const params = new URLSearchParams();
    params.set("limit", limit.toString());
    params.set("offset", offset.toString());
    if (filters?.task) params.set("task", filters.task);
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return this.request<any[]>("GET", `/orgs/${orgId}/sar${qs ? `?${qs}` : ""}`);
  }

  async getSarEntry(orgId: string, sarId: string) {
    return this.request<any>("GET", `/orgs/${orgId}/sar/${sarId}`);
  }

  // Setup wizard
  async setupDetectDb() {
    return this.request<{
      postgresql: { available: boolean; connectionUrl?: string; databases?: string[]; error?: string };
      sqlite: { available: boolean };
    }>("POST", "/setup/detect-db", {});
  }

  async setupCreateDb(superuserUrl: string, dbName?: string, dbUser?: string, dbPassword?: string) {
    return this.request<{ success: boolean; connectionUrl?: string; error?: string }>(
      "POST", "/setup/create-db", { superuserUrl, dbName, dbUser, dbPassword }
    );
  }

  async setupTestDb(engine: string, url: string) {
    return this.request<{ success: boolean; error?: string }>("POST", "/setup/test-db", { engine, url });
  }

  async setupTestAi(provider: string, apiKey?: string, model?: string, baseUrl?: string) {
    return this.request<{ success: boolean; provider?: string; models?: number }>("POST", "/setup/test-ai", { provider, apiKey, model, baseUrl });
  }

  async setupComplete(config: any) {
    return this.request<{ success: boolean }>("POST", "/setup/complete", config);
  }
}

export const api = new ApiClient();
