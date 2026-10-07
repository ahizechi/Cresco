import { useRef, useState } from "react";
import { Btn } from "../ui/controls";
import { dashboard, confirmDialog, toast } from "../core/state";
import {
  exportRoutines,
  restoreRoutines,
  routineBackup,
} from "../../features/sections/routines-storage";
export function RoutineBackups() {
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function read(file: File) {
    try {
      if (file.size > 2 * 1024 * 1024)
        throw Error("Routines backup exceeds 2 MB.");
      const backup = routineBackup(JSON.parse(await file.text()));
      confirmDialog({
        title: "Restore routines backup?",
        text:
          "This replaces your ongoing routines with " +
          backup.data.routines.length +
          " routines. Export your current records first to keep both.",
        ok: "Restore routines",
        danger: true,
        f: () => {
          setBusy(true);
          void restoreRoutines(backup)
            .then(() => location.reload())
            .catch((e) => toast(String(e), { error: true }))
            .finally(() => setBusy(false));
        },
      });
    } catch (e) {
      toast(String(e), { error: true });
    }
  }
  return (
    <div className="backup-row">
      <strong>Ongoing routines</strong>
      <div>
        <Btn
          disabled={busy || !dashboard.routines.ready}
          onClick={() =>
            void exportRoutines()
              .then((ok) => toast(ok ? "Backup exported" : "Export cancelled"))
              .catch((e) => toast(String(e), { error: true }))
          }
        >
          Export routines backup
        </Btn>{" "}
        <Btn disabled={busy} onClick={() => picker.current?.click()}>
          Restore routines backup
        </Btn>
      </div>
      <input
        hidden
        type="file"
        accept=".json,application/json"
        ref={picker}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void read(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
