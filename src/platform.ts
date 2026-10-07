import { validateRoutines } from "./features/sections/routines";
import { invoke, isTauri } from "@tauri-apps/api/core";
export const desktop = isTauri();
export type PersistedSection = "routines";
export async function sectionStateLoad(
  section: PersistedSection,
): Promise<{ data: unknown; revision: number }> {
  if (desktop) return invoke("routines_load");
  const saved = localStorage.getItem("cresco-" + section + "-v1");
  if (!saved) return { data: { routines: [] }, revision: 0 };
  const value = JSON.parse(saved);
  if (!Number.isSafeInteger(value.revision) || value.revision < 0)
    throw Error("Invalid routines revision.");
  validateRoutines(value.data);
  return value;
}
export async function sectionStateSave(
  section: PersistedSection,
  data: unknown,
  revision: number,
): Promise<number> {
  if (desktop) return invoke("routines_save", { data, revision });
  return navigator.locks.request("cresco-" + section, async () => {
    const old = await sectionStateLoad(section);
    if (old.revision !== revision)
      throw Error("Routines changed in another process. Reload before saving.");
    localStorage.setItem(
      "cresco-" + section + "-v1",
      JSON.stringify({ data, revision: revision + 1 }),
    );
    return revision + 1;
  });
}
