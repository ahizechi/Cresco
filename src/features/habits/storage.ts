import { invoke } from "@tauri-apps/api/core";
import { desktop } from "../../platform";
import { trackedMutation } from "../../updates/writes";
import { emptyHabits, validateHabits, type HabitData } from "./model";
export const previewKey = "cresco-habits-preview-v1";
export async function loadHabits(): Promise<HabitData> {
  if (desktop) return validateHabits(await invoke("habits_load"));
  const saved = localStorage.getItem(previewKey);
  return saved ? validateHabits(JSON.parse(saved)) : emptyHabits();
}
export async function saveHabits(
  data: HabitData,
  recovery = false,
): Promise<HabitData> {
  if (recovery) return trackedMutation(() => persistHabits(data, true));
  return persistHabits(data, false);
}
async function persistHabits(
  data: HabitData,
  recovery: boolean,
): Promise<HabitData> {
  validateHabits(data);
  if (JSON.stringify(data).length > 16 * 1024 * 1024)
    throw new Error(
      "Habits exceeds the 16 MB storage limit. Nothing was changed.",
    );
  if (desktop)
    return validateHabits(await invoke("habits_save", { data, recovery }));
  return navigator.locks.request(previewKey, async () => {
    let current: HabitData | undefined;
    try {
      current = await loadHabits();
    } catch {
      if (!recovery)
        throw new Error(
          "Habits could not be read. Reload to recover your data.",
        );
    }
    if (recovery) {
      if (current)
        throw new Error("Habits can be read again. Reload before restoring.");
      localStorage.setItem(
        `${previewKey}-unreadable-${Date.now()}`,
        localStorage.getItem(previewKey) ?? "",
      );
    } else {
      if (current?.revision !== data.revision)
        throw new Error(
          "Habits changed in another window. Reload Habits before saving again.",
        );
      const old = localStorage.getItem(previewKey);
      if (old) localStorage.setItem(`${previewKey}-previous`, old);
    }
    const next = { ...data, revision: (current?.revision ?? 0) + 1 };
    localStorage.setItem(previewKey, JSON.stringify(next));
    return next;
  });
}
export async function exportHabits(data: HabitData) {
  validateHabits(data);
  const content = JSON.stringify(data, null, 2);
  if (desktop) return invoke<boolean>("habits_export", { content });
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "cresco-habits-backup.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
