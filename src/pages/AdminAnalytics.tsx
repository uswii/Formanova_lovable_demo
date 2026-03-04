import { useQuery } from "@tanstack/react-query";
import { tenantApi, adminApi } from "@/lib/pipeline-api";
import { PipelineAdminNav } from "@/components/admin/PipelineAdminNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

function StatCard({ title, value, loading }: { title: string; value: string | number | undefined; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <p className="text-3xl font-bold">{value ?? "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Aggregate daily volume from workflow list
function buildDailyVolume(workflows: { created_at: string | null; actual_cost: number }[]) {
  const map: Record<string, { day: string; volume: number; cost: number }> = {};
  for (const wf of workflows) {
    if (!wf.created_at) continue;
    const day = wf.created_at.slice(0, 10);
    if (!map[day]) map[day] = { day, volume: 0, cost: 0 };
    map[day].volume += 1;
    map[day].cost += wf.actual_cost;
  }
  return Object.values(map).sort((a, b) => a.day.localeCompare(b.day)).slice(-30);
}

// Top users by spend from user list (rough proxy via balance consumed — we just show balance here)
function buildTopUsers(users: { email: string; balance: number }[]) {
  return [...users].sort((a, b) => b.balance - a.balance).slice(0, 10);
}

export default function AdminAnalytics() {
  const { data: financials, isLoading: finLoading } = useQuery({
    queryKey: ["financials"],
    queryFn: () => tenantApi.getFinancials(),
    staleTime: 30_000,
  });

  const { data: workflowsData, isLoading: wfLoading } = useQuery({
    queryKey: ["admin-workflows", 1, "", "", ""],
    queryFn: () => adminApi.getWorkflows(1, 500),
    staleTime: 30_000,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", 1, ""],
    queryFn: () => adminApi.getUsers(1, 100),
    staleTime: 30_000,
  });

  const dailyData = workflowsData ? buildDailyVolume(workflowsData.workflows) : [];
  const topUsers = usersData ? buildTopUsers(usersData.users) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PipelineAdminNav />
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {/* P&L Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Revenue (cr)" value={financials?.total_revenue?.toLocaleString()} loading={finLoading} />
        <StatCard title="Provider Cost (cr)" value={financials?.total_provider_cost?.toLocaleString()} loading={finLoading} />
        <StatCard title="Net Margin (cr)" value={financials?.net_margin?.toLocaleString()} loading={finLoading} />
        <StatCard title="Workflows" value={financials?.workflow_count?.toLocaleString()} loading={finLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily volume line chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Workflow Volume (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {wfLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="volume" stroke="#6366f1" strokeWidth={2} dot={false} name="Workflows" />
                  <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={false} name="Credits" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top users bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Users by Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topUsers} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="email"
                    tick={{ fontSize: 10 }}
                    width={120}
                    tickFormatter={(v: string) => v.split("@")[0]}
                  />
                  <Tooltip />
                  <Bar dataKey="balance" fill="#6366f1" name="Balance" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
