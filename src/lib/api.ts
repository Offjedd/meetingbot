export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://169.58.57.242:3000";

export const API_KEY = import.meta.env.VITE_API_KEY || "";

export function apiHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(API_KEY ? { "x-api-key": API_KEY } : {}),
  };
}
