import { useContext } from "react";
import { AppDataContext, type AppDataContextValue } from "./AppDataContext";

export type AppDataResult = AppDataContextValue;

export function useAppData(): AppDataResult {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within an AppDataProvider");
  return ctx;
}
