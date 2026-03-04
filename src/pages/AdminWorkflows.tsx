import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi } from "@/lib/pipeline-api";
import { PipelineAdminNav } from "@/components/admin/PipelineAdminNav";
import { PipelineStatusBadge } from "@/components/admin/PipelineStatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;
const STATUSES = ["", "running", "completed", "failed", "cancelled"];

export default function AdminWorkflows() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [workflowName, setWorkflowName] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-workflows", page, status, tenantId, workflowName],
    queryFn: () =>
      adminApi.getWorkflows(page, PAGE_SIZE, {
        status: status || undefined,
        tenant_id: tenantId || undefined,
        workflow_name: workflowName || undefined,
      }),
    staleTime: 30_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PipelineAdminNav />
      <h1 className="text-2xl font-bold mb-4">Workflows</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={status} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.filter(Boolean).map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Workflow name…"
          className="w-52"
          value={workflowName}
          onChange={(e) => { setWorkflowName(e.target.value); setPage(1); }}
        />
        <Input
          placeholder="Tenant ID…"
          className="w-52 font-mono text-sm"
          value={tenantId}
          onChange={(e) => { setTenantId(e.target.value); setPage(1); }}
        />
      </div>

      {error && <p className="text-destructive text-sm mb-4">{String(error)}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Provider</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {data?.workflows.map((wf) => (
              <TableRow key={wf.id}>
                <TableCell>
                  <Link
                    to={`/admin/workflows/${encodeURIComponent(wf.id)}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {wf.id.slice(0, 16)}…
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{wf.workflow_name}</TableCell>
                <TableCell><PipelineStatusBadge status={wf.status} /></TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{wf.tenant_id}</TableCell>
                <TableCell className="text-right font-semibold">{wf.actual_cost}</TableCell>
                <TableCell className="text-right text-muted-foreground">{wf.total_provider_cost}</TableCell>
                <TableCell className={`text-right font-semibold ${wf.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {wf.margin >= 0 ? "+" : ""}{wf.margin}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {wf.created_at ? new Date(wf.created_at).toLocaleString() : "—"}
                </TableCell>
              </TableRow>
            ))}
            {data?.workflows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No workflows found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
    </div>
  );
}
