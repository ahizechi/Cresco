import { test, expect } from "@playwright/test";
import { createUpdateService, type Candidate } from "../src/updates/service";
import {
  pauseAndDrain,
  resumeEditing,
  trackedMutation,
  trackWrite,
  editingAllowed,
} from "../src/updates/writes";

function fixture(failure = "") {
  const calls: string[] = [];
  let fail = failure;
  const candidate: Candidate = {
    version: "99.0.0",
    async close() {
      calls.push("close");
    },
    async downloadAndInstall(progress, options) {
      calls.push("download");
      expect(options).toEqual({ timeout: 120000, restartAfterInstall: true });
      progress({ event: "Started", data: { contentLength: 10 } });
      progress({ event: "Progress", data: { chunkLength: 5 } });
      if (fail === "download" || fail === "cancel")
        throw Error("Synthetic download failure");
      progress({ event: "Finished" });
    },
  };
  const service = createUpdateService({
    enabled: true,
    async check(options) {
      calls.push("check");
      expect(options.timeout).toBe(20000);
      if (fail === "check") throw Error("Offline");
      return fail === "latest" ? null : candidate;
    },
    async drain() {
      calls.push("drain");
      if (fail === "drain") throw Error("Save failed");
    },
    async prepare() {
      calls.push("prepare");
      if (fail === "prepare") throw Error("Disk full");
    },
    async cancel() {
      calls.push("cancel");
      if (fail === "cancel") throw Error("IPC disconnected");
    },
    resume() {
      calls.push("resume");
    },
  });
  return {
    calls,
    service,
    retry() {
      fail = "";
    },
  };
}
test("available updates wait for consent, finish saves before download and remain locked after install", async () => {
  const { calls, service } = fixture();
  await service.checkNow();
  expect(calls).toEqual(["check"]);
  expect(service.snapshot().state).toBe("available");
  await service.installUpdate();
  expect(calls).toEqual(["check", "drain", "prepare", "download"]);
  expect(service.snapshot().progress).toBe(100);
  await service.checkNow();
  await service.installUpdate();
  expect(calls).toHaveLength(4);
});
for (const failure of ["drain", "prepare", "download"]) {
  test(
    failure + " failure preserves data, unlocks and supports retry",
    async () => {
      const f = fixture(failure);
      await f.service.checkNow();
      await f.service.installUpdate();
      expect(f.service.snapshot().state).toBe("error");
      expect(f.calls).toContain("resume");
      if (failure === "drain") expect(f.calls).not.toContain("prepare");
      else expect(f.calls).toContain("cancel");
      f.retry();
      await f.service.checkNow();
      expect(f.calls).toContain("close");
      await f.service.installUpdate();
      expect(f.service.snapshot().state).toBe("installing");
    },
  );
}
test("failed native cancellation keeps editing locked and requires restart", async () => {
  const f = fixture("cancel");
  await f.service.checkNow();
  await f.service.installUpdate();
  expect(f.calls).not.toContain("resume");
  expect(f.service.snapshot().message).toContain("Close and reopen Cresco");
  const count = f.calls.length;
  await f.service.checkNow();
  await f.service.installUpdate();
  expect(f.calls).toHaveLength(count);
});
test("offline checks are retryable and a current version never downloads", async () => {
  const f = fixture("check");
  await f.service.checkNow();
  expect(f.service.snapshot().state).toBe("error");
  f.retry();
  await f.service.checkNow();
  expect(f.service.snapshot().state).toBe("available");
  const latest = fixture("latest");
  await latest.service.checkNow();
  await latest.service.installUpdate();
  expect(latest.calls).toEqual(["check"]);
  expect(latest.service.snapshot().state).toBe("latest");
});
test("accepted backup restores are drained and new restores never start while paused", async () => {
  let finish!: () => void;
  const restore = trackedMutation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await Promise.resolve();
  const drain = pauseAndDrain();
  let invoked = false;
  await expect(
    trackedMutation(async () => {
      invoked = true;
    }),
  ).rejects.toThrow("Editing is paused");
  expect(invoked).toBe(false);
  expect(editingAllowed()).toBe(false);
  finish();
  await restore;
  await drain;
  resumeEditing();
});
test("rejected save promises also resume editing after a failed drain", async () => {
  let fail!: (reason: Error) => void;
  trackWrite(
    new Promise<boolean>((_, reject) => {
      fail = reject;
    }),
  );
  const drain = pauseAndDrain();
  fail(Error("Synthetic failed IPC"));
  await expect(drain).rejects.toThrow("Synthetic failed IPC");
  expect(editingAllowed()).toBe(true);
});
