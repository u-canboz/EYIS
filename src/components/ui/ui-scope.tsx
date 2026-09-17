import { createContext, useContext } from "react";

// React context crosses Radix portals; CSS inheritance does not. The caller
// supplies its own scope so customer pages retain their own design tokens.
const UiScope = createContext<string | undefined>(undefined);
export const UiScopeProvider = UiScope.Provider;
export function useUiScope() {
  return useContext(UiScope);
}
