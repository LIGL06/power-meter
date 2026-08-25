import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAppData } from "@/state/useAppData";
import { AppDataProvider } from "@/state/AppDataProvider";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PeriodDetailPage } from "@/features/dashboard/PeriodDetailPage";
import { ReadingEntryPage } from "@/features/reading-entry/ReadingEntryPage";
import { ReadingHistoryPage } from "@/features/reading-entry/ReadingHistoryPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { AddMeterPage } from "@/features/onboarding/AddMeterPage";
import { AdminTariffsPage } from "@/features/admin/tariffs/AdminTariffsPage";
import { Toaster } from "@/components/ui/sonner";
import { ServerUnreachable } from "@/components/ServerUnreachable";

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
}

function ConnectionGate({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ServerUnreachable onRetry={onRetry} />
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, authReady, contract, contractReady, user, serverUnreachable, retryConnection } =
    useAppData();

  if (!authReady) {
    return <LoadingScreen />;
  }

  const contractGate = serverUnreachable ? <ConnectionGate onRetry={retryConnection} /> : <LoadingScreen />;

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
            contractGate
          ) : contract ? (
            <Navigate to="/" replace />
          ) : (
            <AddMeterPage />
          )
        }
      />
      {/* Admin-only surface — deliberately NOT gated on `contract`: an admin's job may be
          purely managing the global tariff catalog, with no personal meter contract at all
          (a real gap found live — a contract-less admin got stuck at /onboarding, unable
          to ever reach this screen through the nav). */}
      <Route
        path="admin/tariffs"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : user?.role !== "ADMIN" ? (
            <Navigate to="/" replace />
          ) : (
            <AppShell />
          )
        }
      >
        <Route index element={<AdminTariffsPage />} />
      </Route>
      <Route
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : !contractReady ? (
            contractGate
          ) : !contract ? (
            // A regular user has no reason to be here without a meter — the whole app is
            // about tracking one. An admin's job may be exclusively managing the global
            // tariff catalog (the seeded admin account has none at all, confirmed live) —
            // forcing them through onboarding to reach anything at all was a real gap
            // found in testing, so they land on their own home instead.
            <Navigate to={user?.role === "ADMIN" ? "/admin/tariffs" : "/onboarding"} replace />
          ) : (
            <AppShell />
          )
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="periods/:periodId" element={<PeriodDetailPage />} />
        <Route path="reading" element={<ReadingEntryPage />} />
        <Route path="reading/history" element={<ReadingHistoryPage />} />
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
