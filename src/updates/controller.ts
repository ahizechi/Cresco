import { useSyncExternalStore } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { invoke } from "@tauri-apps/api/core";
import { desktop } from "../platform";
import { pauseAndDrain, resumeEditing } from "./writes";
import { createUpdateService } from "./service";
export type { UpdateState } from "./service";
const service = createUpdateService({
  enabled: desktop,
  check,
  drain: pauseAndDrain,
  prepare: () => invoke("prepare_update"),
  cancel: () => invoke("cancel_update"),
  resume: resumeEditing,
});
export function useUpdates() {
  return useSyncExternalStore(service.subscribe, service.snapshot);
}
export const checkNow = service.checkNow;
export const installUpdate = service.installUpdate;
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
