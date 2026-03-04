import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/lib/pipeline-api";
import { PipelineAdminNav } from "@/components/admin/PipelineAdminNav";
import { PipelineStatusBadge } from "@/components/admin/PipelineStatusBadge";
import { PipelineCreditsModal } from "@/components/admin/PipelineCreditsModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, PlusCircle } from "lucide-react";

export default function AdminUserDetail() {
  const { externalId } = useParams<{ externalId: string }>();
  const decoded = decodeURIComponent(externalId ?? "");
  const [creditsOpen, setCreditsOpen] = useState(false);

  const { data: balance, isLoading: balLoading } = useQuery({
    queryKey: ["user-balance", decoded],
    queryFn: () => tenantApi.getUserBalance(decoded),
    staleTime: 30_000,
  });

  const { data: workflows, isLoading: wfLoading } = useQuery({
    queryKey: ["user-workflows", decoded],
    queryFn: () => tenantApi.getUserWorkflows(decoded),
    staleTime: 30_000,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PipelineAdminNav />

      <Link to="/admin/users" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Detail</h1>
          <p className="font-mono text-sm text-muted-foreground">{decoded}</p>
        </div>
        <Button onClick={() => setCreditsOpen(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Add Credits
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <BalanceCard title="Balance" value={balance?.balance} loading={balLoading} />
        <BalanceCard title="Reserved" value={balance?.reserved_balance} loading={balLoading} />
        <BalanceCard
          title="Available"
          value={balance ? balance.balance - balance.reserved_balance : undefined}
          loading={balLoading}
        />
      </div>

      {/* Workflow History */}
      <h2 className="text-lg font-semibold mb-3">Workflow History</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {wfLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {workflows?.map((wf) => (
              <TableRow key={wf.id}>
                <TableCell>
                  <Link
                    to={`/admin/workflows/${encodeURIComponent(wf.id)}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {wf.id.slice(0, 20)}…
                  </Link>
                </TableCell>
                <TableCell>{wf.workflow_name}</TableCell>
                <TableCell><PipelineStatusBadge status={wf.status} /></TableCell>
                <TableCell className="text-right">{wf.actual_cost}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {wf.created_at ? new Date(wf.created_at).toLocaleString() : "—"}
                </TableCell>
              </TableRow>
            ))}
            {workflows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No workflows yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {balance && (
        <PipelineCreditsModal
          open={creditsOpen}
          onOpenChange={setCreditsOpen}
          externalId={decoded}
          currentBalance={balance.balance}
        />
      )}
    </div>
  );
}

function BalanceCard({ title, value, loading }: { title: string; value: number | undefined; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-3xl font-bold">{value?.toLocaleString() ?? "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}
