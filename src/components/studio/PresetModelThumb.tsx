import { Check, Loader2 } from 'lucide-react';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { type PresetModel } from '@/lib/models-api';

export function PresetModelThumb({ model, isSelected, onSelect, fixedAspect = false }: {
  model: PresetModel;
  isSelected: boolean;
  onSelect: () => void;
  fixedAspect?: boolean;
}) {
  const resolvedSrc = useAuthenticatedImage(model.url);
  return (
    <div className="break-inside-avoid mb-2">
      <button
        onClick={onSelect}
        className={`group relative overflow-hidden border transition-all duration-200 w-full ${
          isSelected ? 'border-foreground' : 'border-border/20 hover:border-foreground/30'
        } ${fixedAspect ? 'aspect-[3/4]' : ''}`}
      >
        {resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt={model.label}
            className={`w-full group-hover:scale-105 transition-transform duration-300 ${fixedAspect ? 'h-full object-cover' : 'block'}`}
            style={{ boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.15)' }}
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-muted/30 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
          </div>
        )}
        {isSelected && (
          <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
            <div className="w-6 h-6 bg-foreground flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-background" />
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
