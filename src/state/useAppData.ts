import { useContext } from "react";
import { AppDataContext } from "./AppDataContext";

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within an AppDataProvider");
  return ctx;
}
