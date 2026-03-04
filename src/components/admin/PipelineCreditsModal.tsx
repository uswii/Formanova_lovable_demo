import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/pipeline-api";

interface PipelineCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalId: string;
  currentBalance: number;
}

export function PipelineCreditsModal({
  open,
  onOpenChange,
  externalId,
  currentBalance,
}: PipelineCreditsModalProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  async function handleTopUp() {
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) return;
    setLoading(true);
    try {
      const result = await tenantApi.topUpUser(externalId, parsed) as { new_balance?: number };
      toast({
        title: "Credits added",
        description: `New balance: ${result?.new_balance ?? currentBalance + parsed}`,
      });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["user-balance", externalId] });
      onOpenChange(false);
      setAmount("");
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Credits</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Current balance: <strong className="text-foreground">{currentBalance}</strong>
          </p>
          <div className="space-y-1">
            <Label htmlFor="credit-amount">Amount to add</Label>
            <Input
              id="credit-amount"
              type="number"
              min={1}
              placeholder="e.g. 1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTopUp()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleTopUp} disabled={loading || !amount}>
            {loading ? "Adding…" : "Add Credits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
