import { editingAllowed, trackWrite } from "../../updates/writes";
import { useCallback, useEffect, useRef, useState } from "react";

/** Serialises full snapshots while rebasing only their storage revision. */
export function useRevisionedData<T extends { revision: number }>(
  initial: T,
  load: () => Promise<T>,
  save: (value: T) => Promise<T>,
  sample: (() => T) | null,
  label: string,
) {
  const [data, setData] = useState(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(initial);
  const committed = useRef(initial);
  const queue = useRef<
    {
      value: T;
      resolves: ((saved: boolean) => void)[];
    }[]
  >([]);
  const writing = useRef(false);
  useEffect(() => {
    let alive = true;
    void (sample ? Promise.resolve(sample()) : load()).then(
      (value) => {
        if (!alive) return;
        current.current = value;
        committed.current = value;
        setData(value);
        setReady(true);
      },
      (reason) => {
        if (alive) setError(String(reason));
      },
    );
    return () => {
      alive = false;
    };
  }, [load, sample]);
  useEffect(() => {
    if (sample) return;
    let active = true;
    const check = () => {
      if (!ready || writing.current || queue.current.length) return;
      void load().then(
        (latest) => {
          if (
            !active ||
            writing.current ||
            queue.current.length ||
            latest.revision <= committed.current.revision
          )
            return;
          committed.current = latest;
          current.current = latest;
          setData(latest);
          setError("");
        },
        () => undefined,
      );
    };
    window.addEventListener("focus", check);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
    };
  }, [load, ready, sample]);
  const flush = useCallback(async () => {
    if (writing.current) return;
    writing.current = true;
    while (queue.current.length) {
      try {
        const candidate = {
          ...queue.current[0].value,
          revision: committed.current.revision,
        };
        const saved = await save(candidate);
        committed.current = saved;
        queue.current.shift()?.resolves.forEach((resolve) => resolve(true));
        if (!queue.current.length) {
          current.current = saved;
          setData(saved);
          setError("");
        }
      } catch (reason) {
        queue.current.forEach((entry) =>
          entry.resolves.forEach((resolve) => resolve(false)),
        );
        queue.current = [];
        current.current = committed.current;
        setData(committed.current);
        const message =
          reason instanceof Error ? reason.message : String(reason);
        if (message.includes("changed in another")) {
          try {
            const latest = await load();
            committed.current = latest;
            current.current = latest;
            setData(latest);
            setError(
              `${label} changed elsewhere (another window). The latest saved version is shown.`,
            );
          } catch {
            setError(
              `${label} changed elsewhere. Reload Cresco before editing again.`,
            );
          }
        } else setError(`Could not save ${label}: ${message}`);
      }
    }
    writing.current = false;
  }, [save, load, label]);
  const update = useCallback(
    (change: (value: T) => T): Promise<boolean> => {
      if (!ready || !editingAllowed()) return Promise.resolve(false);
      const next = change(current.current);
      if (next === current.current) return Promise.resolve(true);
      current.current = next;
      setData(next);
      if (sample) return Promise.resolve(true);
      return trackWrite(
        new Promise<boolean>((resolve) => {
          const pending = queue.current[writing.current ? 1 : 0];
          if (pending) {
            pending.value = next;
            pending.resolves.push(resolve);
          } else queue.current.push({ value: next, resolves: [resolve] });
          void flush();
        }),
      );
    },
    [ready, sample, flush],
  );
  return { data, ready, error, update };
}
