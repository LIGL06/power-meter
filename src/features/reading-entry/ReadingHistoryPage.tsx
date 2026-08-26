import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAppData } from "@/state/useAppData";
import type { Reading } from "@/domain/types";
import { formatKwh, formatShortDate } from "@/lib/format";
import { getErrorMessage } from "@/lib/api";
import { readingsRepository } from "@/data/repositories/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

export function ReadingHistoryPage() {
  const { contract, estimate, refetchBilling } = useAppData();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [ready, setReady] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (targetPage: number) => {
      if (!contract) return null;
      const res = await readingsRepository.list(contract.id, { page: targetPage, limit: PAGE_SIZE });
      setReadings(res.items);
      setPages(res.meta.pages);
      return res;
    },
    [contract],
  );

  useEffect(() => {
    if (!contract) return;
    let cancelled = false;
    setReady(false);
    fetchPage(page).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [contract, page, fetchPage]);

  // Only a reading in the still-open period is deletable — the API rejects deletes on a
  // closed period (its bill has already been issued), matching the same rule the reading
  // entry page's edit path already respects.
  function isDeletable(reading: Reading): boolean {
    return !!estimate && reading.billingPeriodId === estimate.period.id;
  }

  async function handleDelete(reading: Reading) {
    setDeletingId(reading.id);
    try {
      await readingsRepository.remove(reading.id);
      toast.success("Reading deleted");
      setConfirmingId(null);
      const [result] = await Promise.all([fetchPage(page), refetchBilling()]);
      // Deleting the last reading on a page past the first would otherwise strand the view
      // on a now-empty page (readings older than 20 are common once a period runs long
      // without closing) — step back one instead of showing a false "no readings" state.
      if (result && result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  if (!contract) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reading history</CardTitle>
        <CardDescription>
          Every reading logged for this meter, newest first.{" "}
          <Link to="/reading" className="text-primary underline underline-offset-4 hover:text-primary/80">
            Back to Daily Reading
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!ready ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : readings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No readings logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Import</th>
                  <th className="py-2 pr-3 font-medium">Δ Import</th>
                  {contract.hasExports && <th className="py-2 pr-3 font-medium">Export</th>}
                  {contract.hasExports && <th className="py-2 pr-3 font-medium">Δ Export</th>}
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Notes</th>
                  <th className="py-2 pl-3 text-right font-medium">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((reading) => (
                  <tr key={reading.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{formatShortDate(reading.readAt)}</td>
                    <td className="py-2 pr-3">{formatKwh(reading.importIndex)}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{formatKwh(reading.deltaImportKwh)}</td>
                    {contract.hasExports && (
                      <td className="py-2 pr-3">{reading.exportIndex != null ? formatKwh(reading.exportIndex) : "—"}</td>
                    )}
                    {contract.hasExports && (
                      <td className="py-2 pr-3 text-muted-foreground">{formatKwh(reading.deltaExportKwh)}</td>
                    )}
                    <td className="py-2 pr-3 text-muted-foreground">{reading.source}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{reading.notes || "—"}</td>
                    <td className="py-2 pl-3 text-right">
                      {isDeletable(reading) ? (
                        confirmingId === reading.id ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="destructive"
                              size="xs"
                              disabled={deletingId === reading.id}
                              onClick={() => handleDelete(reading)}
                            >
                              Confirm
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              disabled={deletingId === reading.id}
                              onClick={() => setConfirmingId(null)}
                            >
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <Button type="button" variant="ghost" size="xs" onClick={() => setConfirmingId(reading.id)}>
                            Delete
                          </Button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground" title="This reading's billing period is already closed.">
                          Locked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {pages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
