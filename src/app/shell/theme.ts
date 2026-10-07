// Theme and sidebar preferences, kept per viewer.
import { prefs } from "../core/prefs";
import { S, updateView } from "../core/state";
import type { ViewState } from "../core/view";

/** The theme the native shell stamped before the app loaded, if any. */
const HOST_THEME = document.documentElement.dataset.theme || null;

export function applyTheme() {
  const theme = S.theme === "system" ? HOST_THEME : S.theme;
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

export function setTheme(theme: ViewState["theme"]) {
  updateView((view) => {
    view.theme = theme;
  });
  prefs.set("theme", theme);
  applyTheme();
}

export function toggleCollapsed() {
  updateView((view) => {
    view.collapsed = !view.collapsed;
  });
  prefs.set("collapsed", S.collapsed);
}
