// The presentation's view model. Sample mode fills it from the illustrative
// seed; real mode projects the native stores into it (see ./hydrate). Money is
// in integer minor units; days are local YYYY-MM-DD strings.
import type { MouseEvent as ReactMouseEvent } from "react";
import type { IconName } from "../ui/icons";
import type { PageId } from "./routes";

/* ---------- finance ---------- */
export interface TxnRow {
  id: string;
  date: string;
  merchant: string;
  cat: string;
  categorySource?: "suggested" | "manual" | "known" | "rule";
  suggestedReview?: "unsure";
  acct: string;
  amt: number;
  kind?: "income" | "expense" | "transfer" | "adjustment";
  status: "cleared" | "pending";
  source: string;
  note: string;
  importId?: string | null;
  /** Transfer id: the other account in sample data, a pair id in real data. */
  transfer?: string | null;
}
export interface AccountRow {
  id: string;
  name: string;
  inst: string;
  type: string;
  cur: string;
  bal: number;
  source: string;
  synced: string;
  reconciled: string | null;
  archived: boolean;
  inNet: boolean;
}
export interface BudgetRow {
  cat: string;
  limit: number;
  roll: boolean;
}
export interface ScheduleRow {
  id: string;
  name: string;
  kind: "income" | "bill";
  amt: number;
  freq: string;
  next: string;
  acct: string;
  cat: string;
  start?: string;
  end?: string;
  paused?: boolean;
}
export interface GoalRow {
  id: string;
  name: string;
  icon: IconName;
  tone: string;
  target: number;
  saved: number;
  by: string;
  acct: string;
}
export interface ImportRow {
  id: string;
  when: string;
  source: string;
  count: number;
  status: "applied" | "undone";
  accountId?: string;
  duplicateCount?: number;
  importedAt?: string;
}
export interface BankRow {
  id: string;
  bank: string;
  accounts: string[];
  status: string;
  expires: string;
  synced: string;
}

/* ---------- habits and routines ---------- */
export interface HabitPause {
  from: string;
  until: string | null;
}
export interface HabitRow {
  id: string;
  name: string;
  icon: IconName;
  tone: string;
  unit: string | null;
  kind?: "check" | "count";
  target: number;
  step: number;
  /** Scheduled weekdays, Sunday 0. */
  days: number[];
  tod: string;
  cat: string;
  why: string;
  status: "active" | "paused" | "archived";
  created: string;
  pauses?: HabitPause[];
}
export interface RoutineRow {
  id: string;
  name: string;
  kind: "timer" | "streak" | "days";
  status: "running" | "paused" | "stopped";
  value: string;
  note: string;
  /** In-memory illustrative run evidence; native timing stays in the section store. */
  elapsedMs?: number;
  runs?: { ended: string; elapsedMs: number }[];
}

/* ---------- UI state (never persisted) ---------- */
export interface MenuItem {
  l?: string;
  i?: IconName;
  /** Runs the item; a submenu item receives the press to anchor its menu. */
  f?: (event: MenuEvent) => void;
  danger?: boolean;
  sep?: boolean;
  /** A group heading instead of an item. */
  head?: string;
  /** Makes the item a radio choice. */
  checked?: boolean;
  /** Opens a submenu and keeps this menu open. */
  sub?: boolean;
  disabled?: boolean;
}
export interface OpenMenu {
  r: DOMRect;
  items: MenuItem[];
  align: "start" | "end";
  anchor: HTMLElement;
  sub: boolean;
  t: number;
}
export interface OpenLayer {
  type: string;
  props: Record<string, unknown>;
  key: number;
}
export interface ToastItem {
  id: number;
  msg: string;
  error?: boolean;
  undo?: () => void;
}
export interface Route {
  page: PageId;
  tab: string | null;
}
export type Preview = "populated" | "loading" | "empty" | "error";

export interface ViewState {
  profile: { name: string; tz: string; weekStart: string };
  txns: TxnRow[];
  accounts: AccountRow[];
  budgets: BudgetRow[];
  schedules: ScheduleRow[];
  goals: GoalRow[];
  imports: ImportRow[];
  banks: BankRow[];
  cashflow: {
    labels: string[];
    income: (number | null)[];
    spend: (number | null)[];
  };
  habits: HabitRow[];
  hlog: Record<string, number>;
  hskip: Record<string, string>;
  hnote: Record<string, string>;
  routines: RoutineRow[];
  settings: { motion: string; sample: boolean };
  route: Route;
  tabs: Partial<Record<PageId, string>>;
  theme: "system" | "light" | "dark";
  collapsed: boolean;
  preview: Preview;
  ui: {
    dialog: OpenLayer | null;
    sheet: OpenLayer | null;
    menu: OpenMenu | null;
    palette: boolean;
    drawer: boolean;
  };
  toasts: ToastItem[];
}
export type MenuEvent = ReactMouseEvent<HTMLElement>;
