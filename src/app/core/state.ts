// The live view model and the UI actions around it: navigation, toasts,
// dialogs, sheets and menus. Data changes go through ./commands.
import emptyView from "../empty-view.json" with { type: "json" };
import { sampleMode, sampleSeed } from "@sample";
import type { Dashboard } from "../../features/sections/useDashboard";
import type { DialogProps, SheetProps } from "../shell/registry";
import { prefs } from "./prefs";
import { PAGES, isPage, pageMeta, type PageId } from "./routes";
import type { MenuEvent, MenuItem, Route, ToastItem, ViewState } from "./view";

function initialRoute(): Route {
  const saved = prefs.get<Partial<Route> | null>("route", null);
  const page: PageId = isPage(saved?.page) ? saved.page : "habits";
  const tabs = pageMeta(page).tabs;
  // Validate the remembered route against this app?s own tabs.
  const tab = tabs
    ? tabs.some((item) => item.id === saved?.tab)
      ? (saved!.tab as string)
      : tabs[0].id
    : typeof saved?.tab === "string"
      ? saved.tab
      : null;
  return { page, tab };
}

export const S: ViewState = {
  ...(JSON.parse(
    JSON.stringify(sampleMode ? sampleSeed : emptyView),
  ) as ViewState),
  settings: { motion: prefs.get("motion", "system"), sample: false },
  route: initialRoute(),
  tabs: {},
  theme: prefs.get("theme", "system"),
  collapsed: prefs.get("collapsed", false),
  preview: "populated",
  ui: { dialog: null, sheet: null, menu: null, palette: false, drawer: false },
  toasts: [],
};

let rerender = () => {};
/** The stores. The shell binds them before any page renders. */
export let dashboard = undefined as unknown as Dashboard;

/** Connects the view to the mounted app: its stores and its re-render. */
export function bindView(data: Dashboard, update: () => void) {
  dashboard = data;
  rerender = update;
}

/** Edits view-only state (UI, sample data, fetched readings) and re-renders. */
export function updateView(change: (view: ViewState) => void) {
  change(S);
  rerender();
}

export function go(page: PageId, tab?: string) {
  updateView((view) => {
    view.route = {
      page,
      tab: tab || view.tabs[page] || PAGES[page].tabs?.[0]?.id || null,
    };
    if (tab) view.tabs[page] = tab;
    view.ui.drawer = false;
    view.ui.menu = null;
  });
  prefs.set("route", S.route);
  document.querySelector(".content")?.scrollTo(0, 0);
}

let toastCount = 0;
type ToastPause = "pointer" | "focus";
type ToastClock = {
  remaining: number;
  started: number;
  timer: ReturnType<typeof setTimeout> | null;
  pauses: Set<ToastPause>;
};
const toastClocks = new Map<number, ToastClock>();
function armToast(id: number, clock: ToastClock) {
  clock.started = performance.now();
  clock.timer = setTimeout(() => dismissToast(id), clock.remaining);
}
export interface ToastOptions {
  error?: boolean;
  undo?: () => void;
}
export function toast(msg: string, options: ToastOptions = {}) {
  const id = ++toastCount;
  const item: ToastItem = { id, msg, ...options };
  for (const old of S.toasts.slice(0, Math.max(0, S.toasts.length - 2)))
    dismissToast(old.id);
  const clock: ToastClock = {
    remaining: options.undo ? 7000 : 4000,
    started: performance.now(),
    timer: null,
    pauses: new Set(),
  };
  toastClocks.set(id, clock);
  updateView((view) => {
    view.toasts = [...view.toasts.slice(-2), item];
  });
  armToast(id, clock);
}
export function dismissToast(id: number) {
  const clock = toastClocks.get(id);
  if (clock?.timer != null) clearTimeout(clock.timer);
  toastClocks.delete(id);
  if (!S.toasts.some((item) => item.id === id)) return;
  updateView((view) => {
    view.toasts = view.toasts.filter((item) => item.id !== id);
  });
}

/** Undo remains reachable while the person is reading or keyboarding through it. */
export function pauseToast(id: number, reason: ToastPause) {
  const clock = toastClocks.get(id);
  if (!clock || clock.pauses.has(reason)) return;
  if (!clock.pauses.size) {
    clock.remaining = Math.max(
      0,
      clock.remaining - (performance.now() - clock.started),
    );
    if (clock.timer != null) clearTimeout(clock.timer);
    clock.timer = null;
  }
  clock.pauses.add(reason);
}
export function resumeToast(id: number, reason: ToastPause) {
  const clock = toastClocks.get(id);
  if (!clock || !clock.pauses.delete(reason) || clock.pauses.size) return;
  armToast(id, clock);
}

let layerCount = 0;
export type DialogType = keyof DialogProps;
export type SheetType = keyof SheetProps;

/** Props are optional when every prop of that layer is. */
type LayerArgs<P> = object extends P ? [props?: P] : [props: P];

export function openDialog<K extends DialogType>(
  type: K,
  ...[props]: LayerArgs<DialogProps[K]>
) {
  updateView((view) => {
    view.ui.dialog = {
      type,
      props: (props ?? {}) as Record<string, unknown>,
      key: ++layerCount,
    };
    view.ui.menu = null;
  });
}
export function closeDialog() {
  updateView((view) => {
    view.ui.dialog = null;
  });
}
export function openSheet<K extends SheetType>(
  type: K,
  ...[props]: LayerArgs<SheetProps[K]>
) {
  updateView((view) => {
    view.ui.sheet = {
      type,
      props: (props ?? {}) as Record<string, unknown>,
      key: ++layerCount,
    };
    view.ui.menu = null;
  });
}
export function closeSheet() {
  updateView((view) => {
    view.ui.sheet = null;
  });
}

export interface ConfirmOptions {
  title: string;
  text: string;
  ok?: string;
  danger?: boolean;
  f: () => void;
}
export function confirmDialog(options: ConfirmOptions) {
  openDialog("confirm", options);
}

/** Toggles a row menu anchored to the pressed button. */
export function openMenu(
  event: MenuEvent,
  items: MenuItem[],
  align: "start" | "end" = "end",
) {
  event.stopPropagation();
  const anchor = event.currentTarget;
  const rect = anchor.getBoundingClientRect();
  const sub = !!anchor.closest(".menu");
  updateView((view) => {
    view.ui.menu =
      view.ui.menu?.anchor === anchor
        ? null
        : { r: rect, items, align, anchor, sub, t: performance.now() };
  });
}

let idCount = 5000;
/**
 * A new record id with the given prefix. Saved records get a random suffix so
 * ids stay unique across restarts; sample ids stay short and readable.
 */
export const nid = (prefix: string) =>
  sampleMode ? prefix + ++idCount : `${prefix}-${crypto.randomUUID()}`;
