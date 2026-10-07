const pending = new Set<Promise<boolean>>();
let paused = false;
export const editingAllowed = () => !paused;
export function trackWrite(promise: Promise<boolean>) {
  pending.add(promise);
  void promise.then(
    () => pending.delete(promise),
    () => pending.delete(promise),
  );
  return promise;
}
export async function pauseAndDrain() {
  paused = true;
  try {
    const results = await Promise.all([...pending]);
    if (results.some((ok) => !ok))
      throw Error("A save failed. Resolve it before updating.");
  } catch (error) {
    paused = false;
    throw error;
  }
}
export function trackedMutation<T>(operation: () => Promise<T>): Promise<T> {
  if (paused)
    return Promise.reject(
      Error("An update is being installed. Editing is paused."),
    );
  const result = Promise.resolve().then(operation);
  trackWrite(
    result.then(
      () => true,
      () => false,
    ),
  );
  return result;
}
export function resumeEditing() {
  paused = false;
}
