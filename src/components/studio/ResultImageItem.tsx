import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { TO_SINGULAR } from '@/lib/jewelry-utils';

export function ResultImageItem({ url, index, workflowId, jewelryType, naturalAspect }: {
  url: string;
  index: number;
  workflowId: string | null;
  jewelryType: string;
  naturalAspect?: boolean;
}) {
  const resolvedSrc = useAuthenticatedImage(url);
  return (
    <div className="relative group border border-border/30 overflow-hidden w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)] max-w-xs">
      <img
        src={resolvedSrc ?? ""}
        alt={`Result ${index + 1}`}
        className={`w-full object-contain bg-muted/30${naturalAspect ? '' : ' aspect-[3/4]'}`}
      />
      <div className="absolute top-2 right-2 flex gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm border-border/40 hover:bg-background"
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const resp = await authenticatedFetch(url);
              if (!resp.ok) throw new Error('Fetch failed');
              const blob = await resp.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = `photoshoot-${workflowId?.slice(0, 8)}-${index + 1}.jpg`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(blobUrl);
              import('@/lib/posthog-events').then(m => m.trackDownloadClicked({
                file_type: 'jpg',
                context: 'unified-studio',
                category: TO_SINGULAR[jewelryType] ?? jewelryType,
              }));
            } catch { alert('Download failed. Please try again.'); }
          }}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/80 backdrop-blur-sm border-border/40 hover:bg-background"
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const resp = await authenticatedFetch(url);
              if (!resp.ok) throw new Error('Fetch failed');
              const blob = await resp.blob();
              const blobUrl = URL.createObjectURL(blob);
              window.open(blobUrl, '_blank', 'noopener,noreferrer');
              // Do not revoke -- new tab loads the URL asynchronously
            } catch { /* silent -- tab simply won't open */ }
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
