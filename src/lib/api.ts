import axios, { AxiosError, type AxiosResponse } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

const ACCESS_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";

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

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

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

function getHttpClient() {
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
        const isAuthEndpoint = originalRequest?.url?.startsWith("/auth/");

        if (status === 401 && originalRequest && !originalRequest._retried && !isAuthEndpoint) {
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

        if (status === 401 || status === 403) {
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

export default {
  register,
  login,
  getProfile,
  logout,
};
