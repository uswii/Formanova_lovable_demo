import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tenantApi, WorkflowAuditItem } from "@/lib/pipeline-api";
import { PipelineAdminNav } from "@/components/admin/PipelineAdminNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

function auditRowClass(item: WorkflowAuditItem) {
  if (!item.is_success) return "bg-red-500/5";
  if (item.is_cached) return "bg-blue-500/5";
  if (item.is_retry) return "bg-yellow-500/5";
  return "";
}

export default function AdminWorkflowDetail() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const decoded = decodeURIComponent(workflowId ?? "");

  const { data, isLoading, error } = useQuery({
    queryKey: ["workflow-audit", decoded],
    queryFn: () => tenantApi.getWorkflowAudit(decoded),
    staleTime: 30_000,
  });

  const totalCost = data?.reduce((s, i) => s + i.cost, 0) ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PipelineAdminNav />

      <Link to="/admin/workflows" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Workflows
      </Link>

      <h1 className="text-2xl font-bold mb-1">Workflow Audit</h1>
      <p className="font-mono text-sm text-muted-foreground mb-6 break-all">{decoded}</p>

      {error && <p className="text-destructive text-sm mb-4">{String(error)}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {data?.map((item, i) => (
              <TableRow key={i} className={auditRowClass(item)}>
                <TableCell className="font-mono text-sm">{item.tool_name}</TableCell>
                <TableCell className="text-right font-semibold">{item.cost}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      item.is_success
                        ? "bg-green-500/10 text-green-700 border-green-500/30"
                        : "bg-red-500/10 text-red-700 border-red-500/30"
                    }
                  >
                    {item.is_success ? "success" : "failed"}
                  </Badge>
                </TableCell>
                <TableCell className="flex gap-1 flex-wrap">
                  {item.is_cached && <Badge variant="secondary" className="text-xs">cached</Badge>}
                  {item.is_retry && <Badge variant="secondary" className="text-xs">retry</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {item.created_at ? new Date(item.created_at).toLocaleString() : "—"}
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No audit items found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && data.length > 0 && (
        <p className="text-right mt-3 text-sm font-semibold">
          Total cost: {totalCost} credits
        </p>
      )}
    </div>
  );
}
