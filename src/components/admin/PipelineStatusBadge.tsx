import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-500/15 text-green-700 border-green-500/30",
  running:   "bg-blue-500/15 text-blue-700 border-blue-500/30",
  failed:    "bg-red-500/15 text-red-700 border-red-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-600 border-zinc-500/30",
};

export function PipelineStatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-zinc-500/15 text-zinc-600 border-zinc-500/30";
  return (
    <Badge variant="outline" className={cls}>
      {status}
    </Badge>
  );
}
