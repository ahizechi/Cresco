import { invoke } from "@tauri-apps/api/core";
import { desktop, sectionStateLoad } from "../../platform";
import { validateRoutines } from "./routines";
import { trackedMutation } from "../../updates/writes";
export function routineBackup(value: unknown) {
  if (!value || typeof value !== "object")
    throw Error("Invalid routines backup.");
  const backup = value as { kind: string; revision: number; data: unknown };
  if (
    backup.kind !== "cresco-routines/1" ||
    !Number.isSafeInteger(backup.revision) ||
    backup.revision < 0
  )
    throw Error("Unsupported routines backup.");
  return { ...backup, data: validateRoutines(backup.data) };
}
export async function exportRoutines() {
  if (desktop) return invoke<boolean>("routines_export");
  const saved = await sectionStateLoad("routines");
  const content = JSON.stringify(
    { kind: "cresco-routines/1", ...saved },
    null,
    2,
  );
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "cresco-routines-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export async function restoreRoutines(value: unknown) {
  return trackedMutation(() => restore(value));
}
async function restore(value: unknown) {
  const backup = routineBackup(value);
  if (desktop) {
    let recovery = false;
    try {
      await sectionStateLoad("routines");
    } catch {
      recovery = true;
    }
    return invoke("routines_restore", { data: backup, recovery });
  }
  return navigator.locks.request("cresco-routines", async () => {
    let current: { revision: number; data: unknown } | null = null;
    try {
      current = await sectionStateLoad("routines");
    } catch {}
    const key = "cresco-routines-v1";
    const old = localStorage.getItem(key);
    if (old)
      localStorage.setItem(
        key + (current ? "-previous" : "-unreadable-" + Date.now()),
        old,
      );
    localStorage.setItem(
      key,
      JSON.stringify({
        data: backup.data,
        revision: (current?.revision || 0) + 1,
      }),
    );
  });
}
