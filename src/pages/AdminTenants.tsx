import { useQuery } from "@tanstack/react-query";
import { adminApi, AdminTenant } from "@/lib/pipeline-api";
import { PipelineAdminNav } from "@/components/admin/PipelineAdminNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, GitBranch, DollarSign } from "lucide-react";

function TenantCard({ t }: { t: AdminTenant }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t.name}</CardTitle>
          <Badge variant="outline" className="capitalize">{t.tier}</Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono">{t.id}</p>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4 pt-0">
        <Stat icon={<Users className="h-4 w-4" />} label="Users" value={t.user_count} />
        <Stat icon={<GitBranch className="h-4 w-4" />} label="Workflows" value={t.workflow_count} />
        <Stat icon={<DollarSign className="h-4 w-4" />} label="Revenue" value={`${t.total_revenue} cr`} />
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  );
}

export default function AdminTenants() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => adminApi.getTenants(),
    staleTime: 30_000,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PipelineAdminNav />
      <h1 className="text-2xl font-bold mb-6">Tenants</h1>
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      )}
      {error && <p className="text-destructive text-sm">{String(error)}</p>}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((t) => <TenantCard key={t.id} t={t} />)}
          {data.length === 0 && <p className="text-muted-foreground col-span-3">No tenants found.</p>}
        </div>
      )}
    </div>
  );
}
