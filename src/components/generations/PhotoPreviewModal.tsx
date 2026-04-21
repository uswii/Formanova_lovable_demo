import React from 'react';
import { Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { downloadAsset } from '@/lib/assets-api';

interface PhotoPreviewModalProps {
  imageUrl: string;
  alt?: string;
  onClose: () => void;
  /** Asset UUID — when present, download uses GET /assets/{id}/download for a named file */
  assetId?: string | null;
}

export function PhotoPreviewModal({ imageUrl, alt, onClose, assetId }: PhotoPreviewModalProps) {
  const resolvedSrc = useAuthenticatedImage(imageUrl);

  const handleDownload = async () => {
    if (assetId) {
      await downloadAsset(assetId);
      import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: assetId, file_type: 'jpg', context: 'generations-photo' }));
      return;
    }
    const urlParts = imageUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1].split('?')[0];
    const filename = lastPart || 'generation.jpg';
    const ext = filename.lastIndexOf('.') > 0 ? filename.slice(filename.lastIndexOf('.') + 1) : 'jpg';
    import('@/lib/posthog-events').then(m => m.trackDownloadClicked({ file_name: filename, file_type: ext, context: 'generations-photo' }));
    const res = await authenticatedFetch(imageUrl);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
            Preview
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-4">
          {/* Hero image */}
          <div className="relative bg-muted overflow-hidden">
            <OptimizedImage
              src={resolvedSrc ?? ""}
              alt={alt || 'Preview'}
              className="w-full object-contain max-h-[520px]"
            />
          </div>

          {/* Download button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="font-mono text-[10px] tracking-wider uppercase gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
