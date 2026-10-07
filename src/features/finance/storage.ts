import { invoke } from "@tauri-apps/api/core";
import { desktop } from "../../platform";
import { emptyFinance, validateFinance, type FinanceData } from "./model";
const key = "cresco-finance-preview-v1";
export async function loadFinance(): Promise<FinanceData> {
  if (desktop) return validateFinance(await invoke("finance_load"));
  const saved = localStorage.getItem(key);
  return saved ? validateFinance(JSON.parse(saved)) : emptyFinance();
}
export async function saveFinance(data: FinanceData): Promise<FinanceData> {
  validateFinance(data);
  if (desktop) return validateFinance(await invoke("finance_save", { data }));
  return navigator.locks.request(key, async () => {
    const current = await loadFinance();
    if (current.revision !== data.revision)
      throw new Error(
        "Finance changed in another window. Reload Finance before saving again.",
      );
    const next = { ...data, revision: data.revision + 1 };
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  });
}
export async function recoverFinance(data: FinanceData): Promise<FinanceData> {
  validateFinance(data);
  if (desktop)
    return validateFinance(await invoke("finance_recover", { data }));
  return navigator.locks.request(key, async () => {
    let unreadable = false;
    try {
      await loadFinance();
    } catch {
      unreadable = true;
    }
    if (!unreadable)
      throw new Error(
        "Finance can be read again. Reload before restoring a backup.",
      );
    localStorage.setItem(
      `${key}-unreadable-${Date.now()}`,
      localStorage.getItem(key) ?? "",
    );
    const next = { ...data, revision: 1 };
    localStorage.setItem(key, JSON.stringify(next));
    return next;
  });
}
export async function exportFinanceFile(
  content: string,
  kind: "backup" | "transactions",
): Promise<boolean> {
  if (desktop) return invoke("finance_export", { content, kind });
  const url = URL.createObjectURL(
    new Blob([content], {
      type: kind === "backup" ? "application/json" : "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download =
    kind === "backup"
      ? "cresco-finance-backup.json"
      : "cresco-transactions.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
