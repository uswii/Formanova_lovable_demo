import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchPresetInspirations, uploadInspiration, updateInspiration,
  type PresetInspirationCategory, type PresetInspiration,
} from '@/lib/models-api';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ImageIcon, Loader2, Pencil, Plus, Upload, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function InspirationThumb({ url }: { url: string }) {
  const src = useAuthenticatedImage(url);
  if (!src) return <div className="h-12 w-12 bg-muted animate-pulse shrink-0" />;
  return (
    <img
      src={src}
      alt=""
      className="h-12 w-12 object-cover shrink-0 border border-border/30"
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminInspirationsPage() {
  const [categories, setCategories] = useState<PresetInspirationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [sheetMode, setSheetMode] = useState<'upload' | 'edit' | null>(null);
  const [editingItem, setEditingItem] = useState<PresetInspiration | null>(null);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>('existing');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [filename, setFilename] = useState('');
  const [label, setLabel] = useState('');
  const [editLabel, setEditLabel] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setFetchError(null);
    try {
      const data = await fetchPresetInspirations();
      setCategories(data.categories);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load inspirations';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleFileChange(file: File | null) {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    if (!filename) setFilename(file.name);
  }

  function resetUploadForm() {
    setImageFile(null);
    setImagePreview(null);
    setCategoryMode('existing');
    setSelectedCategory('');
    setNewCategory('');
    setFilename('');
    setLabel('');
    setInlineError('');
  }

  function openUpload() {
    resetUploadForm();
    setSheetMode('upload');
  }

  async function handleUpload() {
    setInlineError('');
    const category = categoryMode === 'new' ? newCategory.trim() : selectedCategory;
    if (!imageFile || !imagePreview) { setInlineError('Select an image first.'); return; }
    if (!category) { setInlineError('Choose or enter a category.'); return; }
    if (/[/.]\./.test(category)) { setInlineError('Category cannot contain / or ..'); return; }
    if (!filename.trim()) { setInlineError('Enter a filename.'); return; }
    if (/[/.]\./.test(filename)) { setInlineError('Filename cannot contain / or ..'); return; }

    const base64 = imagePreview.includes(',') ? imagePreview.split(',')[1] : imagePreview;
    const content_type = imageFile.type || 'image/jpeg';

    setSaving(true);
    try {
      await uploadInspiration({ base64, content_type, category, filename: filename.trim(), label: label.trim() || undefined });
      toast.success(`Inspiration uploaded to "${category}"`);
      setSheetMode(null);
      setLoading(true);
      load();
    } catch (e: any) {
      if (e?.status === 409) {
        setInlineError('A file with this filename already exists in this category.');
      } else if (e?.status === 403) {
        setInlineError('Invalid admin secret — check VITE_PIPELINE_ADMIN_SECRET.');
      } else {
        setInlineError(e?.message ?? 'Upload failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item: PresetInspiration) {
    setEditingItem(item);
    setEditLabel(item.label);
    setInlineError('');
    setSheetMode('edit');
  }

  async function handleEdit() {
    if (!editingItem) return;
    setInlineError('');
    if (!editLabel.trim()) { setInlineError('Label cannot be empty.'); return; }
    if (editLabel.trim() === editingItem.label) { setSheetMode(null); return; }
    setSaving(true);
    try {
      await updateInspiration(editingItem.id, { label: editLabel.trim() });
      toast.success('Inspiration updated');
      setSheetMode(null);
      load();
    } catch (e: any) {
      setInlineError(e?.message ?? 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  const allItems = categories.flatMap((c) =>
    c.inspirations.map((i) => ({ ...i, categoryLabel: c.label }))
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-foreground" />
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
              Preset Inspirations
            </h1>
          </div>
          <Button onClick={openUpload} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Inspiration</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-destructive font-medium">Failed to load inspirations</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); load(); }} className="mt-4">
              Retry
            </Button>
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No inspirations yet. Upload the first one.
          </div>
        ) : (
          <>
            <div className="hidden md:block border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium w-16">Image</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Label</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Category</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">ID</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map((item, idx) => (
                    <tr key={item.id} className={`border-b border-border/50 last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3"><InspirationThumb url={item.url} /></td>
                      <td className="px-4 py-3 font-medium text-foreground">{item.label}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.categoryLabel}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[160px]">{item.id}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Rename">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {allItems.map((item) => (
                <div key={item.id} className="border border-border p-4 flex items-start gap-4">
                  <InspirationThumb url={item.url} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.categoryLabel}</p>
                    <p className="font-mono text-xs text-muted-foreground/60 truncate mt-0.5">{item.id}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Rename">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'} · {allItems.length} {allItems.length === 1 ? 'inspiration' : 'inspirations'} total
            </p>
          </>
        )}
      </div>

      {/* Upload Sheet */}
      <Sheet open={sheetMode === 'upload'} onOpenChange={(o) => !o && setSheetMode(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Upload New Inspiration</SheetTitle>
            <SheetDescription>
              Add a preset inspiration image to a category. It will appear immediately in the inspiration picker.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-5">
            <div className="space-y-2">
              <Label>Image</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative border border-dashed border-border/60 hover:border-foreground/40 hover:bg-foreground/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 py-8"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="max-h-48 max-w-full object-contain" />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select image</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                />
              </div>
              {imageFile && (
                <p className="text-xs text-muted-foreground">{imageFile.name} · {(imageFile.size / 1024).toFixed(0)} KB</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={categoryMode === 'new' ? '__new__' : selectedCategory}
                onValueChange={(v) => {
                  if (v === '__new__') { setCategoryMode('new'); setSelectedCategory(''); }
                  else { setCategoryMode('existing'); setSelectedCategory(v); }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>
                  ))}
                  <SelectItem value="__new__">+ New category…</SelectItem>
                </SelectContent>
              </Select>
              {categoryMode === 'new' && (
                <Input
                  placeholder="e.g. Marble"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="i-filename">Filename</Label>
              <Input
                id="i-filename"
                placeholder="e.g. calacatta.jpg"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Must be unique within the category.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="i-label">Display Label <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="i-label"
                placeholder="e.g. Calacatta"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Auto-derived from filename if left blank.</p>
            </div>

            {inlineError && <p className="text-sm text-destructive">{inlineError}</p>}
          </div>

          <SheetFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSheetMode(null)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {saving ? 'Uploading…' : 'Upload'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Sheet */}
      <Sheet open={sheetMode === 'edit'} onOpenChange={(o) => !o && setSheetMode(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Rename Inspiration</SheetTitle>
            <SheetDescription>Update the display label shown under the thumbnail.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-5">
            <div className="space-y-2">
              <Label htmlFor="edit-label">Display Label</Label>
              <Input
                id="edit-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                autoFocus
              />
            </div>
            {inlineError && <p className="text-sm text-destructive">{inlineError}</p>}
          </div>
          <SheetFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setSheetMode(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
