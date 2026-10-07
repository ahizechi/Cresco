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
  const results = await Promise.all([...pending]);
  if (results.some((ok) => !ok)) {
    paused = false;
    throw Error("A save failed. Resolve it before updating.");
  }
}
export function resumeEditing() {
  paused = false;
}
