import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ServerUnreachableProps {
  onRetry: () => void;
  className?: string;
}

/** Distinct from "not authenticated" or "no data yet" — the backend itself couldn't be reached (see `GET /health`). */
export function ServerUnreachable({ onRetry, className }: ServerUnreachableProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
    >
      <WifiOff className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">Can&apos;t reach the server</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
