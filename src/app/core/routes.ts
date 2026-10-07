import type { IconName } from "../ui/icons";
export interface PageMeta {
  label: string;
  icon: IconName;
  tabs: { id: string; label: string }[] | null;
}
export const PAGES = {
  habits: {
    label: "Habits",
    icon: "sparkles",
    tabs: [
      { id: "today", label: "Today" },
      { id: "all", label: "All habits" },
      { id: "history", label: "History" },
    ],
  },
  finance: {
    label: "Money",
    icon: "wallet",
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "transactions", label: "Transactions" },
      { id: "budgets", label: "Budgets" },
      { id: "goals", label: "Goals" },
      { id: "bills", label: "Bills & income" },
      { id: "accounts", label: "Accounts" },
    ],
  },
  settings: { label: "Settings", icon: "settings", tabs: null },
} satisfies Record<string, PageMeta>;
export type PageId = keyof typeof PAGES;
export const PAGE_IDS = Object.keys(PAGES) as PageId[];
export const isPage = (v: unknown): v is PageId =>
  typeof v === "string" && Object.hasOwn(PAGES, v);
export const pageMeta = (id: PageId): PageMeta => PAGES[id];
