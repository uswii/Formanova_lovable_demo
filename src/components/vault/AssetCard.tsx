// src/components/vault/AssetCard.tsx
// Purely presentational — no data fetching. Restyle freely; keep AssetCardProps stable.

import { useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import type { UserAsset } from '@/lib/assets-api';

export interface AssetCardProps {
  asset: UserAsset;
  onReshoot?: (asset: UserAsset) => void;
  onClick?: (asset: UserAsset) => void;
  reshootLabel?: string;
  /** Show category label + inline rename (gated feature) */
  showMetadata?: boolean;
  onRename?: (asset: UserAsset, newName: string) => void;
}

export function AssetCard({ asset, onReshoot, onClick, reshootLabel, showMetadata, onRename }: AssetCardProps) {
  const label = reshootLabel ?? (asset.asset_type === 'model_photo' ? 'New Shoot' : 'New Style');
  const displayName = asset.metadata?.name || asset.name;
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(displayName ?? '');
  const [saved, setSaved] = useState(false);

  const handleRenameCommit = () => {
    setEditing(false);
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== displayName) {
      onRename?.(asset, trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }
  };

  const cancel = () => {
    setEditing(false);
    setNameInput(displayName ?? '');
  };

  return (
    <div
      className="group relative rounded-lg overflow-hidden bg-card border border-border cursor-pointer hover:border-formanova-glow transition-colors duration-200"
      onClick={() => !editing && onClick?.(asset)}
    >
      <div className="w-full overflow-hidden bg-muted flex flex-col justify-start">
        <img
          src={asset.thumbnail_url}
          alt={displayName ?? (asset.asset_type === 'model_photo' ? 'Model photo' : 'Jewelry photo')}
          className="w-full h-auto block group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      <div className="p-3 min-h-[2.5rem] space-y-1">
        {asset.asset_type === 'model_photo' && (
          editing ? (
            <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                className="font-mono text-xs text-foreground bg-muted/30 border border-foreground/20 focus:border-formanova-glow rounded px-2 py-1 outline-none w-full transition-colors"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameCommit(); if (e.key === 'Escape') cancel(); }}
                placeholder="Enter a name…"
              />
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  onClick={cancel}
                  className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border/30 hover:border-border/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameCommit}
                  className="font-mono text-[9px] uppercase tracking-wider text-background bg-foreground hover:bg-foreground/80 px-2 py-0.5 rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              className="flex items-center gap-1.5 group/rename max-w-full w-full text-left rounded px-1 py-0.5 -mx-1 hover:bg-muted/20 transition-colors"
              title="Click to rename"
              onClick={e => { e.stopPropagation(); setEditing(true); setNameInput(displayName ?? ''); }}
            >
              {saved ? (
                <Check className="h-3 w-3 text-formanova-success flex-shrink-0" />
              ) : (
                <Pencil className="h-3 w-3 text-muted-foreground/50 group-hover/rename:text-foreground/70 flex-shrink-0 transition-colors" />
              )}
              <span className={`font-mono text-xs truncate transition-colors ${saved ? 'text-formanova-success' : 'text-muted-foreground group-hover/rename:text-foreground'}`}>
                {saved ? 'Saved!' : (displayName || <span className="italic opacity-50">Unnamed — click to name</span>)}
              </span>
            </button>
          )
        )}

        {showMetadata && asset.metadata?.category && (
          <span className="text-xs text-muted-foreground capitalize">{asset.metadata.category}</span>
        )}
      </div>

      {onReshoot && (
        <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/20">
          <button
            className="px-4 py-2 bg-formanova-glow text-black text-xs font-bold rounded hover:brightness-110 transition-all"
            onClick={(e) => { e.stopPropagation(); onReshoot(asset); }}
          >
            {label}
          </button>
        </div>
      )}
    </div>
  );
}
