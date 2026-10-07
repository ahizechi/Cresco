// Visual vocabulary shared by every workspace: chip tones, status labels and
// the category tones a user can pick.
export type ChipKind =
  "neutral" | "success" | "warning" | "danger" | "info" | "outline";

export const STATUS: Record<string, [ChipKind, string]> = {
  cleared: ["success", "Cleared"],
  pending: ["warning", "Pending"],
  active: ["success", "Active"],
  running: ["success", "Running"],
  ready: ["info", "Ready on demand"],
  starting: ["warning", "Starting"],
  paused: ["neutral", "Paused"],
  stopped: ["neutral", "Stopped"],
  renew: ["warning", "Renew soon"],
  failed: ["danger", "Failed"],
  succeeded: ["success", "Succeeded"],
  reviewed: ["success", "Reviewed"],
  review: ["warning", "Needs review"],
  draft: ["neutral", "Draft"],
  paper: ["info", "Paper"],
  stale: ["warning", "Stale"],
  partial: ["warning", "Partial"],
  unreadable: ["danger", "Unreadable"],
  complete: ["success", "Complete"],
  connected: ["success", "Connected"],
  missing: ["neutral", "Not set"],
  off: ["neutral", "Off"],
  stoppedsvc: ["neutral", "Stopped"],
  manual: ["neutral", "Manual"],
  filled: ["success", "Filled"],
  cancelled: ["neutral", "Cancelled"],
  applied: ["success", "Applied"],
  undone: ["neutral", "Undone"],
  archived: ["neutral", "Archived"],
  completed: ["success", "Completed"],
  awaiting: ["warning", "Awaiting approval"],
  approved: ["success", "Approved"],
  rejected: ["neutral", "Rejected"],
  notinstalled: ["neutral", "Not set up"],
  warning: ["warning", "Finished with notes"],
  never: ["neutral", "Not run yet"],
};

export const TONES = ["blue", "green", "amber", "rose", "teal", "orange"];
