import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, CopyPlus, Loader2, Lightbulb, Search, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MasonryGrid } from '@/components/ui/masonry-grid';
import { ModelCard, type UserModel } from '@/components/studio/ModelCard';
import { PresetModelThumb } from '@/components/studio/PresetModelThumb';
import { type PresetModel } from '@/lib/models-api';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import creditCoinIcon from '@/assets/icons/credit-coin.png';
const PAIRING_CANVAS_H = 'h-[500px] md:h-[640px]';
interface PresetCategory { id: string; label: string; }
export interface AssetModelPairingAsset { thumbnailUrl: string; assetId: string; }
export interface AssetModelAssignment { url: string; label: string; presetModelId?: string; modelAssetId?: string; }
interface StudioPairingStepProps {
  step2Ref: React.RefObject<HTMLDivElement>;
  modelInputRef: React.RefObject<HTMLInputElement>;
  isProductShot: boolean;
  selectedAssets: AssetModelPairingAsset[];
  activeAssignment: AssetModelAssignment | null;
  assignments: Record<string, AssetModelAssignment>;
  preflightChecking: boolean;
  isModelUploading: boolean;
  isBulkGenerating: boolean;
  isMyModelsEmptyState: boolean;
  myModelsSearch: string;
  customModelImage: string | null;
  selectedModel: PresetModel | null;
  mergedMyModels: UserModel[];
  activePresetCategories: PresetCategory[];
  formanovaCategory: string;
  activePresetLoading: boolean;
  activePresetError: boolean;
  activePresetEmpty: boolean;
  presetModelsForCategory: PresetModel[];
  setModelGuideOpen: (open: boolean) => void;
  setCurrentStep: (step: 'upload' | 'model' | 'generating' | 'results') => void;
  setSelectedModel: (model: PresetModel | null) => void;
  setCustomModelImage: (url: string | null) => void;
  setCustomModelFile: (file: File | null) => void;
  setModelAssetId: (id: string | null) => void;
  setMyModelsSearch: (search: string) => void;
  setFormanovaCategory: (cat: string) => void;
  handleModelUpload: (file: File) => void;
  handleBulkGenerate: () => void;
  handleDeleteUserModel: (id: string) => void;
  handleRenameUserModel: (id: string, newName: string) => void;
  handleSelectLibraryModel: (model: PresetModel) => void;
  onAssignAsset: (assetId: string) => void;
  onClearAssignment: (assetId: string) => void;
  onApplyActiveToAll: () => void;
}
function PairingRow({
  asset,
  index,
  assignment,
  activeAssignment,
  isProductShot,
  onAssignAsset,
  onClearAssignment,
}: {
  asset: AssetModelPairingAsset;
  index: number;
  assignment?: AssetModelAssignment;
  activeAssignment: AssetModelAssignment | null;
  isProductShot: boolean;
  onAssignAsset: (assetId: string) => void;
  onClearAssignment: (assetId: string) => void;
}) {
  const resolvedJewelryUrl = useAuthenticatedImage(asset.thumbnailUrl);
  const resolvedAssignmentUrl = useAuthenticatedImage(assignment?.url ?? null);
  return (
    <div className="grid grid-cols-[92px_1fr] md:grid-cols-[108px_1fr] gap-3 items-center">
      <div className="relative border border-border/20 bg-background/70 aspect-square overflow-hidden">
        <img
          src={resolvedJewelryUrl ?? undefined}
          alt={`Selected piece ${index + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute left-2 top-2 bg-background/85 backdrop-blur-sm px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em]">
          {index + 1}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAssignAsset(asset.assetId)}
        onDragOver={(e) => {
          if (!activeAssignment) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (!activeAssignment) return;
          e.preventDefault();
          onAssignAsset(asset.assetId);
        }}
        className={`group flex items-center justify-between gap-3 min-h-[92px] border px-4 py-3 text-left transition-colors ${
          assignment
            ? 'border-foreground/20 bg-background/80 hover:border-foreground/40'
            : 'border-dashed border-border/30 bg-background/40 hover:border-foreground/30 hover:bg-background/70'
        }`}
      >
        {assignment ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 border border-border/20 overflow-hidden bg-muted/20 flex-shrink-0">
                <img
                  src={resolvedAssignmentUrl ?? undefined}
                  alt={assignment.label}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-foreground">
                  <Check className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] truncate">
                    {assignment.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Click to replace or drag a different {isProductShot ? 'inspiration' : 'model'} here.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearAssignment(asset.assetId);
              }}
              className="w-8 h-8 border border-border/30 flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors flex-shrink-0"
              aria-label="Clear assignment"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-10 h-10 border border-dashed border-border/30 flex items-center justify-center group-hover:border-foreground/30 transition-colors">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em]">
                {activeAssignment
                  ? `Assign ${activeAssignment.label}`
                  : `Choose a ${isProductShot ? 'inspiration' : 'model'} first`}
              </p>
              <p className="text-xs mt-1">
                {activeAssignment
                  ? 'Click this row to stamp the active selection.'
                  : 'Select one from the right panel, then click any piece.'}
              </p>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
export function StudioPairingStep({
  step2Ref,
  modelInputRef,
  isProductShot,
  selectedAssets,
  activeAssignment,
  assignments,
  preflightChecking,
  isModelUploading,
  isBulkGenerating,
  isMyModelsEmptyState,
  myModelsSearch,
  customModelImage,
  selectedModel,
  mergedMyModels,
  activePresetCategories,
  formanovaCategory,
  activePresetLoading,
  activePresetError,
  activePresetEmpty,
  presetModelsForCategory,
  setModelGuideOpen,
  setCurrentStep,
  setSelectedModel,
  setCustomModelImage,
  setCustomModelFile,
  setModelAssetId,
  setMyModelsSearch,
  setFormanovaCategory,
  handleModelUpload,
  handleBulkGenerate,
  handleDeleteUserModel,
  handleRenameUserModel,
  handleSelectLibraryModel,
  onAssignAsset,
  onClearAssignment,
  onApplyActiveToAll,
}: StudioPairingStepProps) {
  const completedCount = selectedAssets.filter((asset) => assignments[asset.assetId]).length;
  const activeResolvedUrl = useAuthenticatedImage(activeAssignment?.url ?? null);
  return (
    <motion.div
      ref={step2Ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="mb-6">
        <span className="marta-label">Step 2</span>
        <h2 className="font-display text-3xl md:text-4xl uppercase tracking-tight mt-2">
          {isProductShot ? 'Pair Each Piece With an Inspiration' : 'Pair Each Piece With a Model'}
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Pick one model, then click pieces on the left to stamp it in place. Drag and drop works too.
        </p>
      </div>
      <input
        ref={modelInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleModelUpload(f); }}
      />
      <div className="grid lg:grid-cols-3 gap-8 lg:gap-10 lg:items-start">
        <div className="lg:col-span-2 space-y-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/70">
                Assignments
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {completedCount} of {selectedAssets.length} ready to generate
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {activeAssignment && (
                <div className="flex min-w-0 items-center gap-2 border border-border/20 bg-background/60 px-3 py-2 max-w-[260px]">
                  <div className="w-8 h-8 border border-border/20 overflow-hidden bg-muted/20 flex-shrink-0">
                    <img
                      src={activeResolvedUrl ?? undefined}
                      alt={activeAssignment.label}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
                      Active
                    </p>
                    <p className="text-xs truncate">{activeAssignment.label}</p>
                  </div>
                </div>
              )}
              {!isProductShot && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModelGuideOpen(true)}
                  className="gap-2 font-mono text-[10px] uppercase tracking-[0.14em]"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  View Guide
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onApplyActiveToAll}
                disabled={!activeAssignment}
                className="gap-2 font-mono text-[10px] uppercase tracking-[0.14em] ml-auto xl:ml-0"
              >
                <CopyPlus className="h-3.5 w-3.5" />
                Apply Active To All
              </Button>
            </div>
          </div>
          <div className={`border border-border/30 bg-muted/5 p-4 md:p-5 overflow-y-auto ${PAIRING_CANVAS_H}`}>
            <div className="space-y-3 pr-1">
              {selectedAssets.map((asset, index) => (
                <PairingRow
                  key={asset.assetId}
                  asset={asset}
                  index={index}
                  assignment={assignments[asset.assetId]}
                  activeAssignment={activeAssignment}
                  isProductShot={isProductShot}
                  onAssignAsset={onAssignAsset}
                  onClearAssignment={onClearAssignment}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-border/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setCurrentStep('upload')}
              className="gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <Button
              size="lg"
              onClick={handleBulkGenerate}
              disabled={completedCount === 0 || preflightChecking || isModelUploading || isBulkGenerating}
              className="gap-2.5 font-display text-lg uppercase tracking-wide bg-gradient-to-r from-[hsl(var(--formanova-hero-accent))] to-[hsl(var(--formanova-glow))] text-background hover:opacity-90 transition-opacity border-0 disabled:opacity-40 disabled:from-muted disabled:to-muted disabled:text-muted-foreground"
            >
              {isBulkGenerating ? 'Starting…' : isModelUploading ? 'Uploading…' : `Generate ${completedCount} Photoshoots`}
              {preflightChecking || isModelUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-1 opacity-70 text-sm font-mono normal-case tracking-normal">
                  ≤ <img src={creditCoinIcon} alt="" className="h-4 w-4 object-contain" /> {completedCount * 10}
                </span>
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-col">
          <div className={`flex flex-col ${PAIRING_CANVAS_H}`}>
            <Tabs defaultValue="formanova" className="w-full flex-1 flex flex-col min-h-0">
              <TabsList className="w-full grid grid-cols-2 mb-3 bg-muted/30 h-11 flex-shrink-0">
                <TabsTrigger value="my-models" className="font-mono text-[10px] uppercase tracking-[0.15em] data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:text-muted-foreground transition-all">
                  {isProductShot ? 'My Inspirations' : 'My Models'}
                </TabsTrigger>
                <TabsTrigger value="formanova" className="font-mono text-[10px] uppercase tracking-[0.15em] data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=inactive]:text-muted-foreground transition-all">
                  {isProductShot ? 'FormaNova Inspirations' : 'FormaNova Models'}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="my-models" className="flex-1 flex flex-col min-h-0 mt-0 space-y-0">
                {isMyModelsEmptyState ? (
                  <button
                    onClick={() => modelInputRef.current?.click()}
                    className="flex-1 w-full border border-dashed border-border/30 bg-muted/5 hover:bg-muted/10 hover:border-foreground/20 transition-all duration-300 flex flex-col items-center justify-center gap-5"
                  >
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                      <div className="absolute inset-[-6px] rounded-full bg-primary/5 animate-ping" style={{ animationDuration: '3.5s', animationDelay: '0.8s' }} />
                      <div className="absolute inset-0 rounded-full bg-muted/30 border-2 border-primary/20 flex items-center justify-center">
                        <UserPlus className="h-9 w-9 text-primary" />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/70">
                        {isProductShot ? 'Upload Your Inspiration' : 'Upload Your Model'}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-wider">
                        Saved here for future shoots
                      </span>
                    </div>
                  </button>
                ) : (
                  <>
                    <div className="relative mb-2 flex-shrink-0">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Type a model name…"
                        value={myModelsSearch}
                        onChange={e => setMyModelsSearch(e.target.value)}
                        className="w-full bg-muted/20 border border-border/20 pl-7 pr-3 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/60 transition-colors"
                      />
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                      <MasonryGrid columns={3} gap={12}>
                        <div className="flex flex-col">
                          <button
                            onClick={() => modelInputRef.current?.click()}
                            className="group/upload relative aspect-[3/4] w-full overflow-hidden border border-dashed border-border/30 transition-all flex flex-col items-center justify-center gap-2 hover:border-foreground/30 hover:bg-foreground/[0.02]"
                          >
                            <div className="relative w-14 h-14">
                              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                              <div className="absolute inset-0 rounded-full bg-primary/5 flex items-center justify-center border-2 border-primary/20">
                                <UserPlus className="h-7 w-7 text-primary" />
                              </div>
                            </div>
                            <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider text-center px-1">
                              Upload
                            </span>
                          </button>
                          <div className="h-10 sm:h-11" />
                        </div>
                        {mergedMyModels
                          .filter(m => !myModelsSearch || m.name.toLowerCase().includes(myModelsSearch.toLowerCase()))
                          .map((model) => {
                            const isActive = customModelImage === model.url;
                            return (
                              <div
                                key={model.id}
                                draggable
                                onDragStart={() => {
                                  setCustomModelImage(model.url);
                                  setSelectedModel(null);
                                  setCustomModelFile(null);
                                  setModelAssetId(model.id.startsWith('user-') ? null : model.id);
                                }}
                              >
                                <ModelCard
                                  model={model}
                                  isActive={isActive}
                                  onSelect={() => {
                                    setCustomModelImage(model.url);
                                    setSelectedModel(null);
                                    setCustomModelFile(null);
                                    setModelAssetId(model.id.startsWith('user-') ? null : model.id);
                                  }}
                                  onDelete={() => handleDeleteUserModel(model.id)}
                                  onRename={(newName) => handleRenameUserModel(model.id, newName)}
                                />
                              </div>
                            );
                          })}
                      </MasonryGrid>
                    </div>
                  </>
                )}
              </TabsContent>
              <TabsContent value="formanova" className="flex-1 mt-0 min-h-0">
                <div className="h-full overflow-y-auto pr-1">
                  <div className="columns-3 gap-2">
                    {activePresetCategories.map((cat) => (
                      <div key={cat.id} className="break-inside-avoid mb-2">
                        <button
                          onClick={() => setFormanovaCategory(cat.id)}
                          className={`w-full px-3 py-3 text-center transition-all duration-200 ${
                            formanovaCategory === cat.id
                              ? 'bg-foreground text-background'
                              : 'bg-transparent text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5'
                          }`}
                        >
                          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] leading-tight">
                            {cat.label}
                          </span>
                        </button>
                      </div>
                    ))}
                    {activePresetLoading ? (
                      <div className="break-inside-avoid mb-2 col-span-full">
                        <div className="border border-border/20 p-4 text-center">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50 mx-auto mb-3" />
                          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            Loading Formanova models
                          </p>
                        </div>
                      </div>
                    ) : activePresetError ? (
                      <div className="break-inside-avoid mb-2 col-span-full">
                        <div className="border border-border/20 p-4 text-center">
                          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            Formanova models are unavailable
                          </p>
                        </div>
                      </div>
                    ) : activePresetEmpty ? (
                      <div className="break-inside-avoid mb-2 col-span-full">
                        <div className="border border-border/20 p-4 text-center">
                          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            No Formanova models found
                          </p>
                        </div>
                      </div>
                    ) : (
                      presetModelsForCategory.map((model) => {
                        const catLabel = activePresetCategories.find(c => c.id === formanovaCategory)?.label ?? '';
                        const isPlain = catLabel.toLowerCase() === 'plain';
                        return (
                          <div
                            key={model.id}
                            draggable
                            onDragStart={() => handleSelectLibraryModel(model)}
                          >
                            <PresetModelThumb
                              model={model}
                              isSelected={selectedModel?.id === model.id && !customModelImage}
                              onSelect={() => handleSelectLibraryModel(model)}
                              fixedAspect={isPlain}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
