import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi, AdminUser } from "@/lib/pipeline-api";
import { PipelineAdminNav } from "@/components/admin/PipelineAdminNav";
import { PipelineCreditsModal } from "@/components/admin/PipelineCreditsModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight, PlusCircle } from "lucide-react";

const PAGE_SIZE = 50;

function useDebounceSearch(value: string, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout.current);
  }, [value, delay]);
  return debounced;
}

import { useRef, useEffect } from "react";

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounceSearch(search);
  const [creditsUser, setCreditsUser] = useState<AdminUser | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", page, debouncedSearch],
    queryFn: () => adminApi.getUsers(page, PAGE_SIZE, debouncedSearch || undefined),
    staleTime: 30_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PipelineAdminNav />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email…"
            className="pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{String(error)}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>External ID</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {data?.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link
                    to={`/admin/users/${encodeURIComponent(u.external_id)}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {u.email}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{u.external_id}</TableCell>
                <TableCell className="font-mono text-xs">{u.tenant_id}</TableCell>
                <TableCell className="text-right font-semibold">{u.balance.toLocaleString()}</TableCell>
                <TableCell className="text-right text-muted-foreground">{u.reserved_balance.toLocaleString()}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1"
                    onClick={() => setCreditsUser(u)}
                  >
                    <PlusCircle className="h-3.5 w-3.5" /> Credits
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data?.users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>{data ? `${data.total} total` : ""}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {creditsUser && (
        <PipelineCreditsModal
          open={!!creditsUser}
          onOpenChange={(o) => { if (!o) setCreditsUser(null); }}
          externalId={creditsUser.external_id}
          currentBalance={creditsUser.balance}
        />
      )}
    </div>
  );
}
