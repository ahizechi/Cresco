// Per-device display preferences (route, theme, sidebar). They are not user
// records: storage can be missing or blocked, so every read has a fallback.
const PREFIX = "cresco-mock:";

export const prefs = {
  get<T>(key: string, fallback: T): T {
    try {
      const value = localStorage.getItem(PREFIX + key);
      return value == null ? fallback : (JSON.parse(value) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage is unavailable; the preference applies to this session only.
    }
  },
};
