import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Download, X, ChevronLeft, ChevronRight,
  Loader2, Upload, ImageOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { getStoredToken } from '@/lib/auth-api';
import { useToast } from '@/hooks/use-toast';
import {
  type AdminFeedbackItem,
  type AdminFeedbackListResponse,
  type FeedbackStatus,
  listAdminFeedback,
  getAdminFeedbackStats,
  getAdminFeedbackById,
  updateAdminFeedback,
  uploadRevisedOutput,
} from '@/lib/feedback-api';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CATEGORIES = ['ring', 'necklace', 'bracelet', 'earring', 'watch', 'other'] as const;

const STATUS_CFG: Record<FeedbackStatus, { label: string; pill: string }> = {
  open:       { label: 'Open',       pill: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  looks_fine: { label: 'Looks Fine', pill: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  resolved:   { label: 'Resolved',   pill: 'bg-muted text-muted-foreground' },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatLocalDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

async function downloadAuthImage(url: string, filename: string) {
  const token = getStoredToken();
  if (!token) return;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch { /* silent */ }
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase tracking-widest whitespace-nowrap ${cfg.pill}`}>
      {cfg.label}
    </span>
  );
}

// ─── ImageThumbnail ───────────────────────────────────────────────────────────

function ImageThumbnail({ url, label }: { url: string | null; label: string }) {
  const [open, setOpen] = useState(false);
  const resolved = useAuthenticatedImage(url);

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      {url ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-20 h-20 border border-border bg-muted/30 overflow-hidden flex items-center justify-center hover:border-foreground/40 transition-colors"
        >
          {resolved
            ? <img src={resolved} alt={label} className="w-full h-full object-cover" />
            : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
          }
        </button>
      ) : (
        <div className="w-20 h-20 border border-border bg-muted/20 flex items-center justify-center">
          <ImageOff className="h-4 w-4 text-muted-foreground/30" />
        </div>
      )}
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>

      {url && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl w-full p-0 overflow-hidden bg-black border-0">
            <div className="relative">
              {resolved
                ? <img src={resolved} alt={label} className="w-full max-h-[82vh] object-contain" />
                : <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
              }
              <div className="absolute top-3 right-3 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => downloadAuthImage(url, `${label.toLowerCase().replace(/\s+/g, '-')}.jpg`)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button size="sm" variant="secondary" className="h-8 w-8 p-0" onClick={() => setOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── DetailSheet ──────────────────────────────────────────────────────────────

interface DetailSheetProps {
  item: AdminFeedbackItem | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (item: AdminFeedbackItem) => void;
}

function DetailSheet({ item, open, onClose, onUpdated }: DetailSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<FeedbackStatus>('open');
  const [contacted, setContacted] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setContacted(item.contacted);
      setAdminNotes(item.admin_notes ?? '');
    }
  }, [item?.id]);

  const saveMutation = useMutation({
    mutationFn: () => updateAdminFeedback(item!.id, { status, contacted, admin_notes: adminNotes }),
    onSuccess: (updated) => {
      onUpdated(updated);
      queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['admin-feedback-stats'] });
      toast({ title: 'Saved' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to save' }),
  });

  async function handleRevisedUpload(file: File) {
    if (!item) return;
    setUploading(true);
    try {
      const result = await uploadRevisedOutput(item.id, file);
      const updated = { ...item, revised_output_url: result.revised_output_url };
      onUpdated(updated);
      queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
      toast({ title: 'Revised output uploaded' });
    } catch {
      toast({ variant: 'destructive', title: 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-5 border-b border-border">
          <SheetTitle className="font-display text-2xl tracking-wide [text-shadow:none]">
            Feedback Detail
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* User & Meta */}
          <div className="space-y-1">
            <p className="font-medium text-sm break-all">{item.user_email}</p>
            {item.username && (
              <p className="text-xs text-muted-foreground">{item.username}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground capitalize">
                {item.category}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {formatLocalDate(item.created_at)}
              </span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground break-all pt-0.5">
              {item.workflow_id}
            </p>
          </div>

          {/* Images */}
          <div className="pt-1 pb-1 border-t border-b border-border py-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Images</p>
            <div className="flex flex-wrap gap-4">
              <ImageThumbnail url={item.input_image_urls?.[0] ?? null} label="Jewelry" />
              <ImageThumbnail url={item.input_image_urls?.[1] ?? null} label="Model" />
              <ImageThumbnail url={item.output_image_url} label="Output" />

              {item.revised_output_url ? (
                <ImageThumbnail url={item.revised_output_url} label="Revised" />
              ) : (
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-20 h-20 border border-dashed border-border bg-muted/10 flex items-center justify-center hover:border-foreground/40 transition-colors disabled:opacity-50"
                  >
                    {uploading
                      ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
                      : <Upload className="h-4 w-4 text-muted-foreground/40" />
                    }
                  </button>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Revised</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRevisedUpload(f); }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Complaint */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Complaint</p>
            <p className="text-sm leading-relaxed text-justify">{item.complaint}</p>
          </div>

          {/* Status & Contacted */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as FeedbackStatus)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_CFG) as FeedbackStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Contacted User</Label>
              <div className="flex items-center h-9">
                <Switch checked={contacted} onCheckedChange={setContacted} />
              </div>
            </div>
          </div>

          {/* Admin Notes */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Admin Notes</Label>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Internal notes visible only to admins..."
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminFeedbackPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<AdminFeedbackItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Deep-link: ?id=<uuid> opens that feedback row directly
  const deepLinkId = searchParams.get('id');
  const deepLinkQuery = useQuery({
    queryKey: ['admin-feedback-by-id', deepLinkId],
    queryFn: () => getAdminFeedbackById(deepLinkId!),
    enabled: !!deepLinkId,
    staleTime: Infinity,
    retry: false,
  });
  useEffect(() => {
    if (deepLinkQuery.data) {
      setActiveItem(deepLinkQuery.data);
      setSheetOpen(true);
    }
  }, [deepLinkQuery.data]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => { setPage(1); setSelected(new Set()); }, [statusFilter, categoryFilter, fromDate, toDate]);

  const queryKey = ['admin-feedback', { search, statusFilter, categoryFilter, fromDate, toDate, page }];

  const statsQuery = useQuery({
    queryKey: ['admin-feedback-stats'],
    queryFn: getAdminFeedbackStats,
  });

  const listQuery = useQuery({
    queryKey,
    queryFn: () => listAdminFeedback({
      q: search || undefined,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      sort_by: 'created_at',
      sort_dir: 'desc',
      page,
      limit: PAGE_SIZE,
    }),
  });

  const bulkMutation = useMutation({
    mutationFn: async (newStatus: FeedbackStatus) =>
      Promise.all([...selected].map(id => updateAdminFeedback(id, { status: newStatus }))),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['admin-feedback-stats'] });
      toast({ title: 'Updated' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Bulk update failed' }),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stats = statsQuery.data;
  const allOnPageSelected = items.length > 0 && items.every(i => selected.has(i.id));
  const hasFilters = !!(searchInput || statusFilter || categoryFilter || fromDate || toDate);

  function toggleAll() {
    setSelected(prev => {
      const s = new Set(prev);
      if (allOnPageSelected) { items.forEach(i => s.delete(i.id)); } else { items.forEach(i => s.add(i.id)); }
      return s;
    });
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(id)) { s.delete(id); } else { s.add(id); }
      return s;
    });
  }

  function openDetail(item: AdminFeedbackItem) {
    setActiveItem(item);
    setSheetOpen(true);
  }

  function clearFilters() {
    setSearchInput(''); setSearch(''); setStatusFilter('');
    setCategoryFilter(''); setFromDate(''); setToDate(''); setPage(1);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Admin</p>
            <h1 className="font-display text-3xl sm:text-4xl tracking-wide [text-shadow:none]">Feedback</h1>
          </div>
          {stats && (
            <div className="text-right">
              <p className="font-display text-3xl sm:text-4xl [text-shadow:none]">{stats.total}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">total</p>
            </div>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {(Object.keys(STATUS_CFG) as FeedbackStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
                className={`border p-4 sm:p-5 text-left transition-colors ${statusFilter === s ? 'border-foreground' : 'border-border hover:border-foreground/40'}`}
              >
                <p className="font-display text-2xl sm:text-3xl [text-shadow:none] mb-2">{stats[s]}</p>
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search email, name, workflow ID, complaint..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={categoryFilter || 'all'} onValueChange={(v) => setCategoryFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-9 w-full sm:w-36 text-sm shrink-0">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 w-full sm:w-36 text-sm shrink-0"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 w-full sm:w-36 text-sm shrink-0"
          />
          {hasFilters && (
            <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 border border-border bg-muted/20">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {selected.size} selected
            </span>
            <div className="flex flex-wrap gap-2 ml-auto">
              {(Object.keys(STATUS_CFG) as FeedbackStatus[]).map(s => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  disabled={bulkMutation.isPending}
                  onClick={() => bulkMutation.mutate(s)}
                  className="h-7 text-xs"
                >
                  Mark {STATUS_CFG[s].label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="border border-border overflow-x-auto">
          {listQuery.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : listQuery.isError ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Failed to load feedback.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">No feedback found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-4">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5"
                    />
                  </TableHead>
                  <TableHead className="w-10 font-mono text-[10px] uppercase tracking-widest">#</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-widest min-w-[160px]">User</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-widest w-24">Category</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-widest min-w-[200px]">Complaint</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-widest w-28">Status</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-widest w-36">Date</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-4">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5"
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <button
                        type="button"
                        title="Filter by this user"
                        onClick={() => setSearchInput(item.user_email)}
                        className="text-left w-full"
                      >
                        <p className="text-sm truncate hover:underline">{item.user_email}</p>
                        {item.username && (
                          <p className="text-xs text-muted-foreground truncate">{item.username}</p>
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs capitalize">{item.category}</span>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <p className="text-sm text-muted-foreground truncate">{item.complaint}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatLocalDate(item.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openDetail(item)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Page {page} of {totalPages} &middot; {total} results
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <DetailSheet
        item={activeItem}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUpdated={(updated) => {
          setActiveItem(updated);
          queryClient.setQueryData(queryKey, (old: AdminFeedbackListResponse | undefined) =>
            old ? { ...old, items: old.items.map((i) => i.id === updated.id ? updated : i) } : old
          );
        }}
      />
    </div>
  );
}
