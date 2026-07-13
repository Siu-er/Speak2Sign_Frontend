export const ONBOARDED_STORAGE_KEY = "s2s:onboarded";

export function hasOnboarded(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDED_STORAGE_KEY) === "1";
}

export function markOnboarded(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDED_STORAGE_KEY, "1");
}
