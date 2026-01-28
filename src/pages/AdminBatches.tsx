import { useState, useEffect } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  RefreshCw, 
  Eye, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Mail,
  Image as ImageIcon,
  Download,
  ExternalLink
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Secret key for admin access
const ADMIN_SECRET = 'formanova-admin-2024';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ADMIN_API_URL = `${SUPABASE_URL}/functions/v1/admin-batches`;

interface BatchJob {
  id: string;
  user_id: string;
  user_email: string;
  user_display_name: string | null;
  jewelry_category: string;
  notification_email: string | null;
  status: string;
  total_images: number;
  completed_images: number;
  failed_images: number;
  workflow_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface BatchImage {
  id: string;
  batch_id: string;
  sequence_number: number;
  original_url: string;
  result_url: string | null;
  mask_url: string | null;
  thumbnail_url: string | null;
  skin_tone: string | null;
  classification_category: string | null;
  classification_is_worn: boolean | null;
  classification_flagged: boolean | null;
  status: string;
  error_message: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  completed: 'bg-green-500/20 text-green-400 border-green-500/50',
  failed: 'bg-red-500/20 text-red-400 border-red-500/50',
  partial: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-400" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-400" />;
  }
};

export default function AdminBatches() {
  const [searchParams] = useSearchParams();
  const [batches, setBatches] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<BatchJob | null>(null);
  const [batchImages, setBatchImages] = useState<BatchImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const secretKey = searchParams.get('key');
  
  // Verify admin access
  if (secretKey !== ADMIN_SECRET) {
    return <Navigate to="/" replace />;
  }

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${ADMIN_API_URL}?key=${ADMIN_SECRET}&action=list_batches`);
      if (!response.ok) throw new Error('Failed to fetch batches');
      const data = await response.json();
      setBatches(data.batches || []);
    } catch (err) {
      console.error('Failed to fetch batches:', err);
      toast({ title: 'Failed to load batches', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchImages = async (batchId: string) => {
    setLoadingImages(true);
    try {
      const response = await fetch(`${ADMIN_API_URL}?key=${ADMIN_SECRET}&action=get_images&batch_id=${batchId}`);
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      setBatchImages(data.images || []);
    } catch (err) {
      console.error('Failed to fetch batch images:', err);
      toast({ title: 'Failed to load images', variant: 'destructive' });
    } finally {
      setLoadingImages(false);
    }
  };

  const handleViewBatch = (batch: BatchJob) => {
    setSelectedBatch(batch);
    fetchBatchImages(batch.id);
  };

  // Export all batches to XLS (CSV format for Excel compatibility)
  const exportToXLS = () => {
    if (batches.length === 0) {
      toast({ title: 'No data to export', variant: 'destructive' });
      return;
    }

    // CSV headers
    const headers = [
      'Batch ID',
      'User ID',
      'User Email',
      'Display Name',
      'Category',
      'Notification Email',
      'Status',
      'Total Images',
      'Completed',
      'Failed',
      'Workflow ID',
      'Created At',
      'Completed At',
      'Error Message'
    ];

    // Convert batches to CSV rows
    const rows = batches.map(batch => [
      batch.id,
      batch.user_id,
      batch.user_email,
      batch.user_display_name || '',
      batch.jewelry_category,
      batch.notification_email || batch.user_email,
      batch.status,
      batch.total_images,
      batch.completed_images,
      batch.failed_images,
      batch.workflow_id || '',
      batch.created_at,
      batch.completed_at || '',
      batch.error_message || ''
    ]);

    // Escape CSV values
    const escapeCSV = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `formanova-batches-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({ title: `Exported ${batches.length} batches to CSV` });
  };

  // Export batch images with Azure URLs
  const exportBatchImages = async () => {
    // Fetch all images via edge function
    try {
      const response = await fetch(`${ADMIN_API_URL}?key=${ADMIN_SECRET}&action=all_images`);
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      const allImages = data.images as BatchImage[];

      if (!allImages?.length) {
        toast({ title: 'No image data to export', variant: 'destructive' });
        return;
      }

    const headers = [
      'Image ID',
      'Batch ID',
      'Sequence',
      'Status',
      'Skin Tone',
      'Classification Category',
      'Is Worn',
      'Flagged',
      'Original URL (Azure)',
      'Result URL (Azure)',
      'Mask URL (Azure)',
      'Thumbnail URL',
      'Processing Started',
      'Processing Completed',
      'Error Message'
    ];

    const rows = (allImages as unknown as BatchImage[]).map(img => [
      img.id,
      img.batch_id,
      img.sequence_number,
      img.status,
      img.skin_tone || '',
      img.classification_category || '',
      img.classification_is_worn ? 'Yes' : 'No',
      img.classification_flagged ? 'Yes' : 'No',
      img.original_url || '',
      img.result_url || '',
      img.mask_url || '',
      img.thumbnail_url || '',
      img.processing_started_at || '',
      img.processing_completed_at || '',
      img.error_message || ''
    ]);

    const escapeCSV = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `formanova-images-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({ title: `Exported ${allImages.length} images with Azure URLs to CSV` });
    } catch (err) {
      console.error('Failed to export images:', err);
      toast({ title: 'Failed to export images', variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Batch Processing Monitor</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToXLS} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Batches
            </Button>
            <Button onClick={exportBatchImages} variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Export Images + URLs
            </Button>
            <Button onClick={fetchBatches} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{batches.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                {batches.filter(b => b.status === 'processing').length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                {batches.filter(b => b.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">
                {batches.filter(b => b.status === 'failed').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Batches Table */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Recent Batches</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No batches submitted yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>User Info</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Notification Email</TableHead>
                      <TableHead>Images</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusIcon status={batch.status} />
                            <Badge className={statusColors[batch.status] || statusColors.pending}>
                              {batch.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            {batch.user_id.slice(0, 8)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {batch.user_display_name || '—'}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {batch.user_email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {batch.jewelry_category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {batch.notification_email || batch.user_email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="text-green-400">{batch.completed_images}</span>
                            <span className="text-muted-foreground">/</span>
                            <span>{batch.total_images}</span>
                            {batch.failed_images > 0 && (
                              <span className="text-red-400 ml-1">
                                ({batch.failed_images} ✗)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(batch.created_at), 'MMM d, HH:mm')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleViewBatch(batch)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batch Detail Dialog */}
        <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <StatusIcon status={selectedBatch?.status || 'pending'} />
                Batch Details
              </DialogTitle>
            </DialogHeader>
            
            {selectedBatch && (
              <div className="space-y-6">
                {/* Batch Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Batch ID:</span>
                    <p className="font-mono text-xs mt-1">{selectedBatch.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">User:</span>
                    <p className="mt-1">{selectedBatch.user_email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <p className="mt-1 capitalize">{selectedBatch.jewelry_category}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Notification Email:</span>
                    <p className="mt-1">{selectedBatch.notification_email || 'Same as user'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Workflow ID:</span>
                    <p className="font-mono text-xs mt-1">{selectedBatch.workflow_id || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <p className="mt-1">{format(new Date(selectedBatch.created_at), 'PPpp')}</p>
                  </div>
                </div>

                {/* Error Message */}
                {selectedBatch.error_message && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 text-sm">{selectedBatch.error_message}</p>
                  </div>
                )}

                {/* Images */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">
                    Images ({batchImages.length})
                  </h3>
                  
                  {loadingImages ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                      ))}
                    </div>
                  ) : batchImages.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No images</p>
                  ) : (
                    <div className="space-y-3">
                      {batchImages.map((img) => (
                        <Card key={img.id} className="p-3 bg-muted/30">
                          <div className="flex items-start gap-4">
                            {/* Thumbnail */}
                            <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                              {img.original_url ? (
                                <img 
                                  src={img.original_url} 
                                  alt={`Image ${img.sequence_number}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            
                            {/* Details */}
                            <div className="flex-1 min-w-0 text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">#{img.sequence_number}</span>
                                <Badge className={statusColors[img.status] || statusColors.pending}>
                                  {img.status}
                                </Badge>
                                {img.classification_flagged && (
                                  <Badge variant="destructive">Flagged</Badge>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                                <div>Skin Tone: {img.skin_tone || 'N/A'}</div>
                                <div>Category: {img.classification_category || 'N/A'}</div>
                                <div>Worn: {img.classification_is_worn ? 'Yes' : 'No'}</div>
                                {img.error_message && (
                                  <div className="col-span-2 text-red-400">
                                    Error: {img.error_message}
                                  </div>
                                )}
                              </div>
                              
                              {/* URLs */}
                              <div className="flex flex-wrap gap-2 pt-1">
                                {img.original_url && (
                                  <a 
                                    href={img.original_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Original
                                  </a>
                                )}
                                {img.result_url && (
                                  <a 
                                    href={img.result_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Result
                                  </a>
                                )}
                                {img.mask_url && (
                                  <a 
                                    href={img.mask_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline"
                                  >
                                    Mask
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
