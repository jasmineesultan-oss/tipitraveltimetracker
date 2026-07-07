import axios from "axios";

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ""}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tipi_token") || sessionStorage.getItem("tipi_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("tipi_token");
      sessionStorage.removeItem("tipi_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message;
  }
  return "An unexpected error occurred";
}
