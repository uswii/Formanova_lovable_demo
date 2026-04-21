import React from 'react';
import { Check, X, Pencil } from 'lucide-react';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';

export interface UserModel {
  id: string;
  name: string;
  url: string;
  uploadedAt: number;
}

export function ModelCard({ model, isActive, onSelect, onDelete, onRename }: {
  model: UserModel;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const resolvedSrc = useAuthenticatedImage(model.url);
  const [editing, setEditing] = React.useState(false);
  const [nameInput, setNameInput] = React.useState(model.name);
  const [saved, setSaved] = React.useState(false);

  const commit = () => {
    setEditing(false);
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== model.name) {
      onRename(trimmed);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } else {
      setNameInput(model.name);
    }
  };

  const cancel = () => {
    setEditing(false);
    setNameInput(model.name);
  };

  return (
    <div className="relative group flex flex-col">
      {/* -- Image area -- */}
      <button
        onClick={onSelect}
        className={`relative overflow-hidden border transition-all w-full ${isActive ? 'border-foreground' : 'border-border/20 hover:border-foreground/30'}`}
      >
        <img src={resolvedSrc ?? undefined} alt={model.name} className="w-full block" loading="lazy" />
        {isActive && (
          <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
            <div className="w-6 h-6 bg-foreground flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-background" />
            </div>
          </div>
        )}
      </button>

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 bg-background/80 flex items-center justify-center z-10"
        aria-label="Delete model"
      >
        <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
      </button>

      {/* -- Naming row -- fixed height for grid alignment -- */}
      <div className="h-10 sm:h-11 flex items-center px-2 overflow-hidden">
        {editing ? (
          <div className="flex items-center gap-1.5 w-full" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              className="font-mono text-[11px] text-foreground bg-muted/30 border border-foreground/20 focus:border-formanova-glow rounded px-2 py-1 outline-none flex-1 min-w-0 transition-colors"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
              placeholder="Enter a name..."
            />
            <button
              onClick={cancel}
              className="flex-shrink-0 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              aria-label="Cancel"
            >
              <X className="h-3 w-3" />
            </button>
            <button
              onClick={commit}
              className="flex-shrink-0 p-1.5 rounded text-foreground hover:bg-muted/30 transition-colors"
              aria-label="Save"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            className="flex items-center justify-center gap-2 sm:gap-2.5 w-full h-full rounded hover:bg-muted/20 transition-colors group/rename"
            title="Click to rename"
            onClick={e => { e.stopPropagation(); setEditing(true); setNameInput(model.name); }}
          >
            {saved ? (
              <>
                <Check className="h-3 w-3 text-formanova-success flex-shrink-0" />
                <span className="font-mono text-[11px] text-formanova-success truncate">Saved!</span>
              </>
            ) : (
              <>
                <span className="font-mono text-[11px] truncate text-foreground transition-colors">
                  {model.name || <span className="italic opacity-60">Click to name</span>}
                </span>
                <Pencil className="h-3 w-3 flex-shrink-0 text-muted-foreground/40 group-hover/rename:text-foreground/60 transition-colors" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
