import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminEmail } from '@/lib/admin-utils';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pencil, Ban, Plus, Loader2, ArrowLeft, TicketPercent } from 'lucide-react';
import { toast } from 'sonner';

interface PromoCode {
  id: string;
  code: string;
  campaign: string;
  credits: number;
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-promo-codes`;

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function codeStatus(code: PromoCode): 'active' | 'expired' | 'inactive' {
  if (!code.is_active) return 'inactive';
  if (code.expires_at && new Date(code.expires_at) < new Date()) return 'expired';
  return 'active';
}

export default function AdminPromoCodes() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formCampaign, setFormCampaign] = useState('');
  const [formCredits, setFormCredits] = useState('');
  const [formMaxUses, setFormMaxUses] = useState('');
  const [formExpires, setFormExpires] = useState('');

  // Guard
  useEffect(() => {
    if (!initializing && !isAdminEmail(user?.email)) {
      navigate('/', { replace: true });
    }
  }, [user, initializing, navigate]);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await authenticatedFetch(BASE);
      if (!res.ok) throw new Error('Failed to load');
      setCodes(await res.json());
    } catch {
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdminEmail(user?.email)) fetchCodes();
  }, [user, fetchCodes]);

  function openCreate() {
    setEditingCode(null);
    setFormCode('');
    setFormCampaign('');
    setFormCredits('');
    setFormMaxUses('');
    setFormExpires('');
    setFormOpen(true);
  }

  function openEdit(c: PromoCode) {
    setEditingCode(c);
    setFormCode(c.code);
    setFormCampaign(c.campaign);
    setFormCredits(String(c.credits));
    setFormMaxUses(c.max_uses !== null ? String(c.max_uses) : '');
    setFormExpires(c.expires_at ? c.expires_at.slice(0, 10) : '');
    setFormOpen(true);
  }

  async function handleSave() {
    if (!formCode.trim() || !formCredits) {
      toast.error('Code and credits are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: formCode,
        campaign: formCampaign,
        credits: Number(formCredits),
        max_uses: formMaxUses ? Number(formMaxUses) : null,
        expires_at: formExpires || null,
      };

      const res = editingCode
        ? await authenticatedFetch(`${BASE}/${editingCode.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await authenticatedFetch(BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (res.status === 409) {
        toast.error('A code with that name already exists');
        return;
      }
      if (!res.ok) throw new Error('Save failed');

      toast.success(editingCode ? 'Code updated' : 'Code created');
      setFormOpen(false);
      fetchCodes();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    try {
      const res = await authenticatedFetch(`${BASE}/${deactivateTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success(`"${deactivateTarget.code}" deactivated`);
      setDeactivateTarget(null);
      fetchCodes();
    } catch {
      toast.error('Failed to deactivate');
    }
  }

  if (initializing || !isAdminEmail(user?.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <TicketPercent className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
            Promo Codes
          </h1>
        </div>
        <p className="text-muted-foreground mb-8 ml-12">
          Create and manage promotional credit codes.
        </p>

        {/* Actions */}
        <div className="flex justify-end mb-6">
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Promo Code
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No promo codes yet. Create your first one.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Code</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => {
                  const status = codeStatus(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium text-foreground tracking-wide">
                        {c.code}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.campaign || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">
                        {c.credits}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {c.times_used}
                        {c.max_uses !== null ? ` / ${c.max_uses}` : ''}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status === 'active' ? 'default' : 'secondary'}
                          className={
                            status === 'active'
                              ? 'bg-primary/15 text-primary border-primary/20'
                              : status === 'expired'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-destructive/15 text-destructive border-destructive/20'
                          }
                        >
                          {status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(c.expires_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(c)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {c.is_active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeactivateTarget(c)}
                              title="Deactivate"
                              className="text-destructive hover:text-destructive"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCode ? 'Edit Promo Code' : 'New Promo Code'}</DialogTitle>
            <DialogDescription>
              {editingCode ? 'Update the details for this promo code.' : 'Create a new promotional credit code.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                placeholder="e.g. WELCOME50"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign</Label>
              <Input
                id="campaign"
                placeholder="e.g. Launch Promo"
                value={formCampaign}
                onChange={(e) => setFormCampaign(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credits">Credits</Label>
                <Input
                  id="credits"
                  type="number"
                  min={1}
                  placeholder="50"
                  value={formCredits}
                  onChange={(e) => setFormCredits(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">Max Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={formMaxUses}
                  onChange={(e) => setFormMaxUses(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires">Expires</Label>
              <Input
                id="expires"
                type="date"
                value={formExpires}
                onChange={(e) => setFormExpires(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingCode ? 'Save Changes' : 'Create Code'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate "{deactivateTarget?.code}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This code will no longer be redeemable. You can't undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
