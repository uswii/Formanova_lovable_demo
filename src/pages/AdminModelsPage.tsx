import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchPresetModels, uploadModel, updateModel,
  type PresetCategory, type PresetModel,
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
import { ImageIcon, Loader2, Pencil, Plus, Upload, LayersIcon } from 'lucide-react';
import { toast } from 'sonner';

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function ModelThumb({ url }: { url: string }) {
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

export default function AdminModelsPage() {
  const [categories, setCategories] = useState<PresetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sheet state
  const [sheetMode, setSheetMode] = useState<'upload' | 'edit' | null>(null);
  const [editingModel, setEditingModel] = useState<PresetModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState('');

  // Upload form
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>('existing');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [filename, setFilename] = useState('');
  const [label, setLabel] = useState('');

  // Edit form
  const [editLabel, setEditLabel] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setFetchError(null);
    try {
      const data = await fetchPresetModels();
      setCategories(data.categories);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load models';
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── File picker ──────────────────────────────────────────────────────────────

  function handleFileChange(file: File | null) {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    // Auto-fill filename if empty
    if (!filename) setFilename(file.name);
  }

  // ── Upload ───────────────────────────────────────────────────────────────────

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

    // Strip data URI prefix — send raw base64
    const base64 = imagePreview.includes(',') ? imagePreview.split(',')[1] : imagePreview;
    const content_type = imageFile.type || 'image/jpeg';

    setSaving(true);
    try {
      await uploadModel({
        base64,
        content_type,
        category,
        filename: filename.trim(),
        label: label.trim() || undefined,
      });
      toast.success(`Model uploaded to "${category}"`);
      setSheetMode(null);
      setLoading(true);
      load();
    } catch (e: any) {
      if (e?.status === 409) {
        setInlineError('A model with this filename already exists in this category. Rename the file.');
      } else if (e?.status === 403) {
        setInlineError('Invalid admin secret — check VITE_PIPELINE_ADMIN_SECRET.');
      } else {
        setInlineError(e?.message ?? 'Upload failed.');
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  function openEdit(model: PresetModel) {
    setEditingModel(model);
    setEditLabel(model.label);
    setInlineError('');
    setSheetMode('edit');
  }

  async function handleEdit() {
    if (!editingModel) return;
    setInlineError('');
    if (!editLabel.trim()) { setInlineError('Label cannot be empty.'); return; }
    if (editLabel.trim() === editingModel.label) { setSheetMode(null); return; }
    setSaving(true);
    try {
      await updateModel(editingModel.id, { label: editLabel.trim() });
      toast.success('Model updated');
      setSheetMode(null);
      load();
    } catch (e: any) {
      setInlineError(e?.message ?? 'Update failed.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const allModels = categories.flatMap((c) =>
    c.models.map((m) => ({ ...m, categoryLabel: c.label }))
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <LayersIcon className="h-6 w-6 text-foreground" />
            <h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
              Preset Models
            </h1>
          </div>
          <Button onClick={openUpload} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Upload Model</span>
            <span className="sm:hidden">Upload</span>
          </Button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fetchError ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-destructive font-medium">Failed to load models</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={() => { setLoading(true); load(); }} className="mt-4">
              Retry
            </Button>
          </div>
        ) : allModels.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No models yet. Upload the first one.
          </div>
        ) : (
          <>
            {/* Desktop table */}
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
                  {allModels.map((m, idx) => (
                    <tr
                      key={m.id}
                      className={`border-b border-border/50 last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}
                    >
                      <td className="px-4 py-3">
                        <ModelThumb url={m.url} />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{m.label}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.categoryLabel}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[160px]">
                        {m.id}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Rename">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {allModels.map((m) => (
                <div key={m.id} className="border border-border p-4 flex items-start gap-4">
                  <ModelThumb url={m.url} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{m.label}</p>
                    <p className="text-sm text-muted-foreground">{m.categoryLabel}</p>
                    <p className="font-mono text-xs text-muted-foreground/60 truncate mt-0.5">{m.id}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(m)} title="Rename">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Category summary */}
            <p className="mt-4 text-xs text-muted-foreground">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'} · {allModels.length} {allModels.length === 1 ? 'model' : 'models'} total
            </p>
          </>
        )}
      </div>

      {/* Upload Sheet */}
      <Sheet open={sheetMode === 'upload'} onOpenChange={(o) => !o && setSheetMode(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Upload New Model</SheetTitle>
            <SheetDescription>
              Add a preset model image to a category. It will appear immediately in the model picker.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-5">

            {/* Image picker */}
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

            {/* Category */}
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
                  placeholder="e.g. Editorial"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  autoFocus
                />
              )}
            </div>

            {/* Filename */}
            <div className="space-y-2">
              <Label htmlFor="m-filename">Filename</Label>
              <Input
                id="m-filename"
                placeholder="e.g. Tina.jpg"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Must be unique within the category.</p>
            </div>

            {/* Label */}
            <div className="space-y-2">
              <Label htmlFor="m-label">Display Label <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="m-label"
                placeholder="e.g. Tina"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Auto-derived from filename if left blank.</p>
            </div>

            {inlineError && (
              <p className="text-sm text-destructive">{inlineError}</p>
            )}
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
            <SheetTitle>Rename Model</SheetTitle>
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
            {inlineError && (
              <p className="text-sm text-destructive">{inlineError}</p>
            )}
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
