"use client";
import { createContext, useContext } from "react";

export const DrawerContext = createContext<() => void>(() => {});

export function useCloseDrawer() {
  return useContext(DrawerContext);
}
