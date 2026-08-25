import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppData } from "@/state/useAppData";
import { AppDataProvider } from "@/state/AppDataProvider";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ReadingEntryPage } from "@/features/reading-entry/ReadingEntryPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { AddMeterPage } from "@/features/onboarding/AddMeterPage";
import { Toaster } from "@/components/ui/sonner";

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
}

function AppRoutes() {
  const { isAuthenticated, authReady, contract, contractReady } = useAppData();

  if (!authReady) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="/auth/*" element={<Navigate to="/login" replace />} />
      <Route
        path="onboarding"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : !contractReady ? (
            <LoadingScreen />
          ) : contract ? (
            <Navigate to="/" replace />
          ) : (
            <AddMeterPage />
          )
        }
      />
      <Route
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : !contractReady ? (
            <LoadingScreen />
          ) : !contract ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <AppShell />
          )
        }
      >
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
        <Toaster />
      </BrowserRouter>
    </AppDataProvider>
  );
}
