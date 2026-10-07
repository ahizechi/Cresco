import { useUpdates, startUpdateChecks } from "../../updates/controller";
import {
  useEffect,
  useLayoutEffect,
  useState,
  type ComponentType,
} from "react";
import { useDashboard } from "../../features/sections/useDashboard";
import { S, bindView, go } from "../core/state";
import { PAGES, type PageId } from "../core/routes";
import { tickClock, setClockZone } from "../core/dates";
import { hydrateFinance } from "../finance/hydrate";
import { hydrateHabits } from "../habits/hydrate";
import { hydrateRoutines } from "../habits/ongoing";
import { HabitsPage } from "../habits/HabitsPage";
import { FinancePage } from "../finance/FinancePage";
import { SettingsPage } from "../settings/SettingsPage";
import { DIALOGS, SHEETS } from "./registry";
import { MenuLayer, Toasts } from "./Overlays";
import { applyTheme } from "./theme";
import { Btn, I } from "../ui/controls";
export default function App() {
  const [, force] = useState(0);
  const data = useDashboard();
  const updates = useUpdates();
  useEffect(startUpdateChecks, []);
  bindView(data, () => force((n) => n + 1));
  useLayoutEffect(() => {
    setClockZone(data.habits.data.timezone);
    hydrateFinance(S, data.finance.data);
    hydrateHabits(S, data.habits.data);
    hydrateRoutines(S, data.routines.value);
    force((n) => n + 1);
  }, [data.finance.data, data.habits.data, data.routines.value]);
  useEffect(() => {
    const tick = () => {
      tickClock();
      hydrateFinance(S, data.finance.data);
      hydrateHabits(S, data.habits.data);
      hydrateRoutines(S, data.routines.value);
      force((n) => n + 1);
    };
    const timer = setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [data]);
  useLayoutEffect(() => {
    applyTheme();
    document.documentElement.dataset.motion = S.settings.motion;
  }, [S.theme, S.settings.motion]);
  const dialog = S.ui.dialog;
  const sheet = S.ui.sheet;
  const Dialog = dialog
    ? (DIALOGS[dialog.type as keyof typeof DIALOGS] as ComponentType<
        Record<string, unknown>
      >)
    : null;
  const Sheet = sheet
    ? (SHEETS[sheet.type as keyof typeof SHEETS] as ComponentType<
        Record<string, unknown>
      >)
    : null;
  const status =
    S.route.page === "finance"
      ? data.finance
      : S.route.page === "habits"
        ? data.habits
        : null;
  return (
    <div className="app cresco-app">
      <aside className="sidebar">
        <div className="cresco-brand">
          <img src="/mark.svg" alt="" width="34" height="34" />
          <span>Cresco</span>
        </div>
        <nav aria-label="Main navigation">
          {(Object.keys(PAGES) as PageId[]).map((id) => (
            <button
              className={"nav-item " + (S.route.page === id ? "active" : "")}
              key={id}
              aria-current={S.route.page === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <I n={PAGES[id].icon} />
              {PAGES[id].label}
            </button>
          ))}
        </nav>
        <div className="cresco-local">Private on this PC</div>
      </aside>
      <div className="main-wrap">
        <div className="main">
          <header className="topbar">
            <span>{PAGES[S.route.page].label}</span>
            {updates.state === "available" ? (
              <Btn sm onClick={() => go("settings")}>
                Update available
              </Btn>
            ) : (
              <span className="meta">Your habits. Your money.</span>
            )}
          </header>
          <main
            className="content"
            inert={
              updates.state === "installing" && S.route.page !== "settings"
            }
          >
            <div className="page">
              {status && !status.ready ? (
                <div className="view">
                  <h1>
                    {status.error ? "Your data needs recovery" : "Loading…"}
                  </h1>
                  <p role={status.error ? "alert" : "status"}>
                    {status.error || "Reading your local records."}
                  </p>
                  {status.error && (
                    <Btn onClick={() => go("settings")}>
                      Open backup settings
                    </Btn>
                  )}
                </div>
              ) : (
                <>
                  {status?.error && (
                    <p role="alert" className="field-error">
                      {status.error}
                    </p>
                  )}
                  {S.route.page === "habits" && (
                    <>
                      {!data.routines.ready && data.routines.error && (
                        <p className="field-error" role="alert">
                          Routines: {data.routines.error}
                        </p>
                      )}
                      <HabitsPage />
                    </>
                  )}
                  {S.route.page === "finance" && <FinancePage />}
                  {S.route.page === "settings" && <SettingsPage />}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
      {Sheet && sheet && (
        <div className="contents" inert={!!Dialog}>
          <Sheet key={sheet.key} {...sheet.props} />
        </div>
      )}
      {Dialog && dialog && <Dialog key={dialog.key} {...dialog.props} />}
      {S.ui.menu && <MenuLayer m={S.ui.menu} />}
      <Toasts />
    </div>
  );
}
