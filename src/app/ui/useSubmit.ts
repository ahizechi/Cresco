import { useState } from "react";
import { apply, type ApplyOptions, type Change } from "../core/commands";
import { closeDialog } from "../core/state";

/**
 * Saves a dialog's change and closes the dialog once it is saved. `busy`
 * disables the submit button while the save is in flight; a failed save
 * leaves the dialog open with the entry intact. A dialog a page owns passes
 * its own `close`.
 */
export function useSubmit(close: () => void = closeDialog) {
  const [busy, setBusy] = useState(false);
  const submit = async (
    change: Change,
    done?: string,
    options?: ApplyOptions,
  ) => {
    setBusy(true);
    try {
      const ok = await apply(change, done, options);
      if (ok) close();
      return ok;
    } finally {
      setBusy(false);
    }
  };
  return { busy, submit };
}
