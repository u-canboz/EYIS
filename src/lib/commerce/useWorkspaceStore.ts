import { useCallback, useSyncExternalStore } from "react";

const KEY = "commerce-os.active-org";
const listeners = new Set<() => void>();
let current = "";
let hydrated = false;

function subscribe(listener: () => void) {
  if (!hydrated) {
    hydrated = true;
    current = window.localStorage.getItem(KEY) ?? "";
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tiny shared store for the active organization id. */
export function useWorkspaceStore() {
  const orgId = useSyncExternalStore(
    subscribe,
    () => current,
    () => "",
  );

  const setOrgId = useCallback((id: string) => {
    if (id === current) return;
    current = id;
    window.localStorage.setItem(KEY, id);
    listeners.forEach((fn) => fn());
  }, []);

  return { orgId, setOrgId };
}
