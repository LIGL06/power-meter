import axios, { AxiosError, type AxiosResponse } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

let httpClient: any = null;

export function getHttpClient(): any {
  if (!httpClient) {
    httpClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30_000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    httpClient.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem("auth_token");
          window.location.href = "/login";
          return Promise.reject(error);
        }
        return Promise.reject(error);
      },
    );
  }
  return httpClient;
}

export interface AuthResponse {
  data: {
  accessToken: string;
  user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  address: string;
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const client = getHttpClient();
  return client.post("/auth/register", data);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const client = getHttpClient();
  return client.post("/auth/login", { email, password });
}

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  address: string;
}

export async function getProfile(): Promise<Profile> {
  const client = getHttpClient();
  return client.get("/auth/me");
}

export interface LogoutResponse {
  accessToken: null;
}

export async function logout(): Promise<LogoutResponse> {
  const client = getHttpClient();
  return client.post("/auth/logout");
}

// Export all functions as default for firstNamespace access
export default {
  register,
  login,
  getProfile,
  logout,
};
