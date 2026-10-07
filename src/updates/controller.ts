import { useSyncExternalStore } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { invoke } from "@tauri-apps/api/core";
import { desktop } from "../platform";
import { pauseAndDrain, resumeEditing } from "./writes";
export type UpdateState = {
  state: "idle" | "checking" | "available" | "latest" | "installing" | "error";
  message: string;
  version: string | null;
  progress: number;
};
let value: UpdateState = {
  state: "idle",
  message: "Updates are signed and delivered through GitHub Releases.",
  version: null,
  progress: 0,
};
let candidate: Update | null = null;
let locked = false;
const listeners = new Set<() => void>();
const emit = (change: Partial<UpdateState>) => {
  value = { ...value, ...change };
  for (const listener of listeners) listener();
};
export function useUpdates() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => value,
  );
}
export async function checkNow() {
  if (!desktop || locked) return;
  locked = true;
  emit({ state: "checking" });
  try {
    await candidate?.close();
    candidate = null;
    candidate = await check({ timeout: 20000 });
    emit({
      state: candidate ? "available" : "latest",
      version: candidate?.version || null,
      message: candidate
        ? "Cresco " +
          candidate.version +
          " is available. " +
          (candidate.body || "")
        : "You have the latest published version.",
    });
  } catch {
    emit({
      state: "error",
      version: null,
      message:
        "Could not check for updates. Check your connection and try again. Your local data is unchanged.",
    });
  } finally {
    locked = false;
  }
}
export async function installUpdate() {
  if (!desktop || locked || !candidate) return;
  locked = true;
  emit({
    state: "installing",
    progress: 0,
    message:
      "Finishing saves, preserving recovery copies, then downloading the signed update?",
  });
  try {
    await pauseAndDrain();
    await invoke("prepare_update");
    let received = 0,
      total = 0;
    await candidate.downloadAndInstall(
      (event) => {
        if (event.event === "Started") total = event.data.contentLength || 0;
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          if (total)
            emit({
              progress: Math.min(100, Math.round((received / total) * 100)),
            });
        }
        if (event.event === "Finished") emit({ progress: 100 });
      },
      { timeout: 120000, restartAfterInstall: true },
    );
    emit({
      message: "Installer started. Cresco will close to finish updating.",
    });
  } catch {
    await invoke("cancel_update").catch(() => {});
    resumeEditing();
    emit({
      state: "error",
      message:
        "Update failed. Your records are preserved. Resolve any save errors, then check again to retry.",
    });
  } finally {
    locked = false;
  }
}
let starts = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;
export function startUpdateChecks() {
  if (!desktop) return () => {};
  if (starts++ === 0) {
    timer = setTimeout(() => void checkNow(), 10000);
    interval = setInterval(() => void checkNow(), 4 * 60 * 60 * 1000);
  }
  return () => {
    if (--starts === 0) {
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
      timer = null;
      interval = null;
    }
  };
}
