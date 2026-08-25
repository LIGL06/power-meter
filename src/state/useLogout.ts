import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { logout as logoutRequest, clearTokens } from "@/lib/api";
import { useAppData } from "./useAppData";

/** Client-side logout always succeeds locally, even if the server request fails. */
export function useLogout() {
  const { isAuthenticated, setUser } = useAppData();
  const navigate = useNavigate();

  return async function logout() {
    if (!isAuthenticated) return;
    try {
      await logoutRequest();
    } catch {
      toast.error("Failed to reach the server; logging out locally");
    } finally {
      clearTokens();
      setUser(null);
      navigate("/login");
    }
  };
}
