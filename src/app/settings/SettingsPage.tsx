import { RoutineBackups } from "./RoutineBackups";
import { useRef, useState } from "react";
import { PageHead } from "../ui/PageHeader";
import { Panel } from "../ui/layout";
import { Btn, Sel } from "../ui/controls";
import { dashboard, S, confirmDialog, toast, updateView } from "../core/state";
import { setTheme } from "../shell/theme";
import { prefs } from "../core/prefs";
import { TZS } from "../habits/selectors";
import { validateFinance } from "../../features/finance/model";
import { validateHabits } from "../../features/habits/model";
import {
  exportFinanceFile,
  recoverFinance,
} from "../../features/finance/storage";
import { exportHabits, saveHabits } from "../../features/habits/storage";
import { UpdatePanel } from "./UpdatePanel";
export function SettingsPage() {
  const picker = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<"finance" | "habits">("finance");
  const [busy, setBusy] = useState(false);
  async function exportData(kind: "finance" | "habits") {
    try {
      const ok =
        kind === "finance"
          ? await exportFinanceFile(
              JSON.stringify(dashboard.finance.data, null, 2),
              "backup",
            )
          : await exportHabits(dashboard.habits.data);
      toast(ok ? "Backup exported" : "Export cancelled");
    } catch (e) {
      toast(String(e), { error: true });
    }
  }
  async function review(file: File) {
    try {
      if (file.size > 64 * 1024 * 1024) throw Error("Backup exceeds 64 MB.");
      const raw = JSON.parse(await file.text());
      const value =
        section === "finance" ? validateFinance(raw) : validateHabits(raw);
      const kind = section;
      const records =
        kind === "finance"
          ? (value as ReturnType<typeof validateFinance>).transactions.length
          : (value as ReturnType<typeof validateHabits>).habits.length;
      confirmDialog({
        title: "Restore " + kind + " backup?",
        text:
          "This replaces your current " +
          kind +
          " records with " +
          records +
          " " +
          (kind === "finance" ? "transactions" : "habits") +
          ". Export your current data first to keep both.",
        ok: "Restore backup",
        danger: true,
        f: () => {
          void restore(kind, value);
        },
      });
    } catch (e) {
      toast("Backup rejected: " + String(e), { error: true });
    }
  }
  async function restore(kind: "finance" | "habits", raw: unknown) {
    setBusy(true);
    try {
      if (kind === "finance") {
        const value = validateFinance(raw);
        if (!dashboard.finance.ready) {
          await recoverFinance(value);
          location.reload();
          return;
        }
        const ok = await dashboard.finance.update((current) => ({
          ...value,
          revision: current.revision,
        }));
        if (!ok)
          throw Error("Finance restore failed. Previous data preserved.");
      } else {
        const value = validateHabits(raw);
        if (!dashboard.habits.ready) {
          await saveHabits(value, true);
          location.reload();
          return;
        }
        const ok = await dashboard.habits.update((current) => ({
          ...value,
          revision: current.revision,
        }));
        if (!ok) throw Error("Habits restore failed. Previous data preserved.");
      }
      toast("Backup restored");
    } catch (e) {
      toast(String(e), { error: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="view">
      <PageHead sub="Local data, appearance and signed updates" />
      <div className="settings-stack">
        <Panel title="Appearance">
          <div className="backup-row">
            <span>Theme</span>
            <Sel
              label="Theme"
              value={S.theme}
              options={["system", "light", "dark"]}
              onChange={(v) => setTheme(v as typeof S.theme)}
            />
          </div>
          <div className="backup-row">
            <span>Motion</span>
            <Sel
              label="Motion"
              value={S.settings.motion}
              options={["system", "on", "reduced"]}
              onChange={(v) => {
                updateView((s) => {
                  s.settings.motion = v;
                });
                prefs.set("motion", v);
              }}
            />
          </div>
          <div className="backup-row">
            <span>Habit time zone</span>
            <Sel
              label="Habit time zone"
              value={dashboard.habits.data.timezone}
              options={[...TZS]}
              onChange={async (v) => {
                const ok = await dashboard.habits.update((d) => ({
                  ...d,
                  timezone: v,
                }));
                toast(ok ? "Time zone saved" : "Time zone could not be saved", {
                  error: !ok,
                });
              }}
            />
          </div>
        </Panel>
        <Panel
          title="Data and backups"
          detail="Desktop records are encrypted for your Windows account. Exported JSON backups are readable; store them privately."
        >
          {(["finance", "habits"] as const).map((kind) => (
            <div className="backup-row" key={kind}>
              <strong>{kind === "finance" ? "Money" : "Habits"}</strong>
              <div>
                <Btn
                  disabled={busy || !dashboard[kind].ready}
                  onClick={() => void exportData(kind)}
                >
                  Export {kind} backup
                </Btn>{" "}
                <Btn
                  disabled={busy}
                  onClick={() => {
                    setSection(kind);
                    picker.current?.click();
                  }}
                >
                  Restore {kind} backup
                </Btn>
              </div>
            </div>
          ))}
          <input
            ref={picker}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void review(f);
              e.target.value = "";
            }}
          />
          <RoutineBackups />
        </Panel>
        <UpdatePanel />
        <Panel
          title="Cresco"
          detail="A local Windows app for habits and personal finance."
        >
          <p>
            No account or cloud sync. CSV imports, merchant rules, budgets,
            goals and scheduled bills stay on your device.
          </p>
          <p className="meta">
            Browser preview uses its own unencrypted browser storage. It does
            not read desktop files.
          </p>
        </Panel>
      </div>
    </div>
  );
}
