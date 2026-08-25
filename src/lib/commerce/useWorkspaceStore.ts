import { useCallback, useEffect, useState } from "react";

const KEY = "commerce-os.active-org";
const listeners = new Set<(id: string) => void>();
let current = "";

/** Tiny shared store for the active organization id. */
export function useWorkspaceStore() {
  const [orgId, setLocal] = useState(current);

  useEffect(() => {
    if (!current) {
      const stored = window.localStorage.getItem(KEY);
      if (stored) {
        current = stored;
        setLocal(stored);
      }
    }
    listeners.add(setLocal);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  const setOrgId = useCallback((id: string) => {
    current = id;
    window.localStorage.setItem(KEY, id);
    listeners.forEach((fn) => fn(id));
  }, []);

  return { orgId, setOrgId };
}
