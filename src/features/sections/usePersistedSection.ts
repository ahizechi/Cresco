import { editingAllowed, trackWrite } from "../../updates/writes";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import {
  sectionStateLoad,
  sectionStateSave,
  type PersistedSection,
} from "../../platform";
import { sampleValue, rememberSample } from "@sample";

// Save at the action boundary: navigation must never cancel an accepted edit.
// Loading a file is read-only, including when normalising an older schema.
export function usePersistedSection<T extends object>(
  section: PersistedSection,
  initial: T,
  revive: (value: unknown) => T,
  preview?: T,
  saveSection: typeof sectionStateSave = sectionStateSave,
) {
  const [value, render] = useState(initial);
  const current = useRef(initial);
  const committed = useRef(initial);
  const revision = useRef(0);
  const queue = useRef<{ value: T; resolves: ((saved: boolean) => void)[] }[]>(
    [],
  );
  const writing = useRef(false);
  const loaded = useRef(false);
  const sample = preview !== undefined;
  const previewSeed = useRef(preview);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loaded.current = false;
    setReady(false);
    if (sample && previewSeed.current) {
      current.current = sampleValue(section, previewSeed.current);
      committed.current = current.current;
      render(current.current);
      loaded.current = true;
      setReady(true);
      setError("");
      return () => {
        active = false;
        loaded.current = false;
      };
    }
    void sectionStateLoad(section)
      .then((saved) => {
        if (!active) return;
        current.current = saved.data === null ? initial : revive(saved.data);
        revision.current = saved.revision;
        committed.current = current.current;
        render(current.current);
        loaded.current = true;
        setReady(true);
      })
      .catch((reason) => {
        if (active)
          setError(String(reason instanceof Error ? reason.message : reason));
      });
    return () => {
      active = false;
      loaded.current = false;
    };
  }, [section, initial, revive, sample]);
  useEffect(() => {
    if (sample) return;
    let active = true;
    const check = () => {
      if (!loaded.current || writing.current || queue.current.length) return;
      void sectionStateLoad(section)
        .then((saved) => {
          if (
            !active ||
            writing.current ||
            queue.current.length ||
            saved.revision <= revision.current
          )
            return;
          current.current = saved.data === null ? initial : revive(saved.data);
          committed.current = current.current;
          revision.current = saved.revision;
          render(current.current);
          setError("");
        })
        .catch(() => undefined);
    };
    window.addEventListener("focus", check);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
    };
  }, [section, initial, revive, sample]);
  const flush = useCallback(async () => {
    if (writing.current) return;
    writing.current = true;
    while (queue.current.length) {
      const entry = queue.current[0];
      try {
        revision.current = await saveSection(
          section,
          entry.value,
          revision.current,
        );
        committed.current = entry.value;
        queue.current.shift()?.resolves.forEach((resolve) => resolve(true));
        if (!queue.current.length) setError("");
      } catch (reason) {
        queue.current.forEach((pending) =>
          pending.resolves.forEach((resolve) => resolve(false)),
        );
        queue.current = [];
        current.current = committed.current;
        render(committed.current);
        const message =
          reason instanceof Error ? reason.message : String(reason);
        if (message.includes("changed in another process")) {
          try {
            const saved = await sectionStateLoad(section);
            current.current =
              saved.data === null ? committed.current : revive(saved.data);
            committed.current = current.current;
            revision.current = saved.revision;
            render(current.current);
            setError(
              "This section changed in another window. The latest saved version is shown.",
            );
          } catch {
            setError(
              "This section changed elsewhere. Reload Cresco before editing it again.",
            );
          }
        } else setError(`Changes could not be saved: ${message}`);
      }
    }
    writing.current = false;
  }, [section, revive, saveSection]);
  const setValue = useCallback(
    (update: SetStateAction<T>): Promise<boolean> => {
      if (!loaded.current || !editingAllowed()) return Promise.resolve(false);
      const next =
        typeof update === "function" ? update(current.current) : update;
      if (next === current.current) return Promise.resolve(true);
      current.current = next;
      render(next);
      if (sample) {
        rememberSample(section, next);
        return Promise.resolve(true);
      }
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
    [section, sample, flush],
  );
  return [value, setValue, ready, error] as const;
}
