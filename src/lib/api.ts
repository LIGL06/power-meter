import axios, { AxiosError, type AxiosResponse } from "axios";
import type { AuthUser } from "@/state/AppDataContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

const ACCESS_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";

// Endpoints that must never trigger a refresh-and-retry themselves — refreshing
// on their own 401 would recurse. Every other /auth/* route (notably /auth/me,
// used for session rehydration) is expected to go through the normal refresh path.
const NO_REFRESH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/refresh"];

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export type { AuthUser };

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: AuthUser;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

let httpClient: ReturnType<typeof axios.create> | null = null;

export function getHttpClient() {
  if (!httpClient) {
    httpClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30_000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    httpClient.interceptors.request.use((config) => {
      const token = getAccessToken();
      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      }
      return config;
    });

    let refreshPromise: Promise<string> | null = null;

    httpClient.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const status = error?.response?.status;
        const originalRequest = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
        const isNoRefreshEndpoint = NO_REFRESH_ENDPOINTS.some((path) => originalRequest?.url?.startsWith(path));

        if (status === 401 && originalRequest && !originalRequest._retried && !isNoRefreshEndpoint) {
          const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          if (refreshToken) {
            originalRequest._retried = true;
            try {
              refreshPromise ??= getHttpClient()
                .post<AuthTokens>("/auth/refresh", { refreshToken })
                .then((res) => {
                  setTokens(res.data.accessToken, res.data.refreshToken);
                  return res.data.accessToken;
                })
                .finally(() => {
                  refreshPromise = null;
                });

              await refreshPromise;
              // The request interceptor re-attaches the (now refreshed) access token.
              return getHttpClient().request(originalRequest);
            } catch {
              clearTokens();
              window.location.href = "/login";
              return Promise.reject(error);
            }
          }
        }

        // 403 is a normal in-session authorization failure (wrong role, not the
        // resource owner) once contract-scoped endpoints are in play — only a
        // 401 with no valid refresh token means the session itself is gone.
        if (status === 401) {
          clearTokens();
          window.location.href = "/login";
        }
        return Promise.reject(error);
      },
    );
  }
  return httpClient;
}

export async function register(data: RegisterRequest) {
  const client = getHttpClient();
  return client.post<AuthTokens>("/auth/register", data);
}

export async function login(email: string, password: string) {
  const client = getHttpClient();
  return client.post<AuthTokens>("/auth/login", { email, password });
}

export async function getProfile() {
  const client = getHttpClient();
  return client.get<AuthUser>("/auth/me");
}

export async function logout() {
  const client = getHttpClient();
  return client.post<void>("/auth/logout");
}

export interface HealthStatus {
  status: "ok" | "degraded";
  database: "up" | "down";
  uptime: number;
  timestamp: string;
}

/** Public — no auth required. Backs the "can't reach the server" resilience state. */
export async function checkHealth() {
  const client = getHttpClient();
  return client.get<HealthStatus>("/health");
}

export default {
  register,
  login,
  getProfile,
  logout,
};

interface ApiErrorPayload {
  message?: string | string[];
}

/**
 * The API's error envelope has `message` as a plain string for most exceptions
 * but a string array for class-validator (400) failures — this normalizes both
 * to one displayable string for toasts.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return "Something went wrong. Please try again.";
}
