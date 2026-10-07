export type UpdateState = {
  state: "idle" | "checking" | "available" | "latest" | "installing" | "error";
  message: string;
  version: string | null;
  progress: number;
};
export type ProgressEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };
export type Candidate = {
  version: string;
  body?: string;
  close(): Promise<void>;
  downloadAndInstall(
    progress: (event: ProgressEvent) => void,
    options: { timeout: number; restartAfterInstall: boolean },
  ): Promise<void>;
};
export function createUpdateService(deps: {
  enabled: boolean;
  check(options: { timeout: number }): Promise<Candidate | null>;
  drain(): Promise<void>;
  prepare(): Promise<void>;
  cancel(): Promise<void>;
  resume(): void;
}) {
  let value: UpdateState = {
    state: "idle",
    message: "Updates are signed and delivered through GitHub Releases.",
    version: null,
    progress: 0,
  };
  let candidate: Candidate | null = null;
  let locked = false;
  const listeners = new Set<() => void>();
  const emit = (change: Partial<UpdateState>) => {
    value = { ...value, ...change };
    for (const listener of listeners) listener();
  };
  return {
    snapshot: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async checkNow() {
      if (!deps.enabled || locked) return;
      locked = true;
      emit({ state: "checking", progress: 0 });
      try {
        const previous = candidate;
        candidate = null;
        await previous?.close();
        candidate = await deps.check({ timeout: 20000 });
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
    },
    async installUpdate() {
      if (!deps.enabled || locked || !candidate) return;
      locked = true;
      emit({
        state: "installing",
        progress: 0,
        message:
          "Finishing saves, preserving recovery copies, then downloading the signed update…",
      });
      let prepared = false;
      try {
        await deps.drain();
        prepared = true;
        await deps.prepare();
        let received = 0,
          total = 0;
        await candidate.downloadAndInstall(
          (event) => {
            if (event.event === "Started")
              total = event.data.contentLength || 0;
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
        // Windows exits inside native installation. Stay locked if it returns.
      } catch {
        try {
          if (prepared) await deps.cancel();
          deps.resume();
          locked = false;
          emit({
            state: "error",
            progress: 0,
            message:
              "Update failed. Your records are preserved. Resolve any save errors, then check again to retry.",
          });
        } catch {
          emit({
            state: "error",
            progress: 0,
            message:
              "Update stopped, but editing could not safely resume. Close and reopen Cresco before editing or retrying. Your saved records are preserved.",
          });
        }
      }
    },
  };
}
