import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppData } from "@/state/useAppData";
import { AppDataProvider } from "@/state/AppDataProvider";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ReadingEntryPage } from "@/features/reading-entry/ReadingEntryPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";

function AppRoutes() {
  const { isAuthenticated } = useAppData();

  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="/auth/*" element={<Navigate to="/login" replace />} />
      <Route element={isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route index element={<DashboardPage />} />
        <Route path="reading" element={<ReadingEntryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppDataProvider>
  );
}
