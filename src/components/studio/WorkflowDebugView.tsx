/**
 * WorkflowDebugView - Displays all DAG node outputs in order
 * Shows images and JSON/text data for debugging workflow pipelines
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Image, FileJson, ChevronDown, ChevronUp, Copy, Check, 
  AlertCircle, Loader2, X, Maximize2, Minimize2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { FLUX_GEN_DAG_STEPS, ALL_JEWELRY_DAG_STEPS } from '@/lib/workflow-api';

interface NodeOutput {
  nodeName: string;
  type: 'image' | 'json';
  data: unknown;
  resolvedImage?: string | null;
  loading?: boolean;
  error?: string;
}

interface WorkflowDebugViewProps {
  results: Record<string, unknown[]> | null;
  workflowType: 'flux_gen' | 'all_jewelry' | 'masking' | 'all_jewelry_masking';
  className?: string;
  onClose?: () => void;
}

// Node order for necklace_point_masking
const MASKING_NODE_ORDER = [
  'image_manipulator',
  'zoom_check',
  'bg_remove',
  'sam3',
];

// Node order for flux_gen_pipeline (complete)
const FLUX_NODE_ORDER = [
  // Initial resizing
  'resize_image',
  'resize_mask',
  'mask_invert_input',
  // Segmentation
  'white_bg_segmenter',
  // Flux generation
  'flux_fill',
  'upscaler',
  'resize_mask_upscale',
  'composite',
  'output_mask',
  'mask_invert_flux',
  'quality_metrics',
  // Gemini refinement pipeline
  'resize_for_gemini',
  'gemini_router',
  'gemini_refine',
  'upscaler_gemini',
  'composite_gemini',
  'output_mask_gemini',
  'mask_invert_gemini',
  'quality_metrics_gemini',
];

// Node order for all_jewelry_masking
const ALL_JEWELRY_MASKING_NODE_ORDER = [
  'resize_all_jewelry',
  'sam3_all_jewelry',
];

// Node order for all_jewelry_generation (complete)
const ALL_JEWELRY_NODE_ORDER = [
  'resize_all_jewelry',
  'mask_invert_input',
  'gemini_sketch',
  'segment_green_bg',
  'composite_all_jewelry',
  'gemini_viton',
  'gemini_quality_check',
  'output_mask_all_jewelry',
  'mask_invert_output',
  'transform_detect',
  'transform_mask',
  'gemini_hand_inpaint',
  'transform_apply',
  'output_mask_final',
  'mask_invert_final',
  'quality_metrics',
];

// Nodes that output images
const IMAGE_NODES = new Set([
  // Masking nodes
  'image_manipulator', 'bg_remove', 'sam3',
  // Flux pipeline
  'resize_image', 'resize_mask', 'mask_invert_input', 'white_bg_segmenter',
  'flux_fill', 'upscaler', 'resize_mask_upscale', 'composite',
  'output_mask', 'mask_invert_flux',
  'resize_for_gemini', 'gemini_refine', 'upscaler_gemini',
  'composite_gemini', 'output_mask_gemini', 'mask_invert_gemini',
  // All jewelry masking
  'sam3_all_jewelry',
  // All jewelry generation
  'resize_all_jewelry', 'gemini_sketch', 'segment_green_bg',
  'composite_all_jewelry', 'gemini_viton', 'output_mask_all_jewelry',
  'mask_invert_output', 'transform_mask', 'gemini_hand_inpaint',
  'transform_apply', 'output_mask_final', 'mask_invert_final',
]);

// Nodes that output JSON/text data
const JSON_NODES = new Set([
  'zoom_check',
  'gemini_router',
  'quality_metrics', 'quality_metrics_gemini',
  'gemini_quality_check',
  'transform_detect',
]);

// Helper to extract Azure URI from various formats
function extractAzureUri(data: unknown): string | null {
  if (!data) return null;
  
  if (typeof data === 'string' && data.startsWith('azure://')) {
    return data;
  }
  
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    
    // Check common fields
    for (const field of ['uri', 'image', 'image_base64', 'mask', 'mask_base64', 'result']) {
      const value = obj[field];
      if (typeof value === 'string' && value.startsWith('azure://')) {
        return value;
      }
      if (typeof value === 'object' && value !== null) {
        const nested = (value as Record<string, unknown>).uri;
        if (typeof nested === 'string' && nested.startsWith('azure://')) {
          return nested;
        }
      }
    }
  }
  
  return null;
}

// Helper to extract base64 data
function extractBase64(data: unknown): string | null {
  if (!data) return null;
  
  if (typeof data === 'string') {
    if (data.startsWith('data:image')) return data;
    // Check if it's raw base64
    if (data.length > 100 && /^[A-Za-z0-9+/=]+$/.test(data.slice(0, 100))) {
      return `data:image/png;base64,${data}`;
    }
  }
  
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    for (const field of ['image_base64', 'mask_base64', 'result_base64', 'base64']) {
      const value = obj[field];
      if (typeof value === 'string') {
        if (value.startsWith('data:image')) return value;
        if (value.length > 100) return `data:image/png;base64,${value}`;
      }
    }
  }
  
  return null;
}

function NodeCard({ node, isExpanded, onToggle, onImageClick }: { 
  node: NodeOutput; 
  isExpanded: boolean; 
  onToggle: () => void;
  onImageClick: (src: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  
  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(node.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const stepInfo = FLUX_GEN_DAG_STEPS[node.nodeName as keyof typeof FLUX_GEN_DAG_STEPS] 
    || ALL_JEWELRY_DAG_STEPS[node.nodeName as keyof typeof ALL_JEWELRY_DAG_STEPS];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border overflow-hidden",
        node.error ? "border-destructive/50 bg-destructive/5" : "border-border bg-card"
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {node.type === 'image' ? (
            <Image className="h-4 w-4 text-primary" />
          ) : (
            <FileJson className="h-4 w-4 text-accent" />
          )}
          <span className="font-mono text-sm font-medium">{node.nodeName}</span>
          {stepInfo && (
            <span className="text-xs text-muted-foreground">({stepInfo.progress}%)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {node.loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {node.error && <AlertCircle className="h-4 w-4 text-destructive" />}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      
      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 border-t border-border">
              {node.error && (
                <div className="text-sm text-destructive mb-2">{node.error}</div>
              )}
              
              {node.type === 'image' && (
                <div className="space-y-2">
                  {node.loading ? (
                    <div className="h-40 bg-muted rounded flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : node.resolvedImage ? (
                    <div 
                      className="relative group cursor-pointer"
                      onClick={() => onImageClick(node.resolvedImage!)}
                    >
                      <img 
                        src={node.resolvedImage} 
                        alt={node.nodeName}
                        className="max-h-60 w-auto rounded border border-border mx-auto"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <Maximize2 className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 bg-muted rounded flex items-center justify-center text-sm text-muted-foreground">
                      No image available
                    </div>
                  )}
                  
                  {/* Show raw data structure */}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Raw data structure
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-32 text-[10px]">
                      {JSON.stringify(node.data, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
              
              {node.type === 'json' && (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <button
                      onClick={copyJson}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-3 bg-muted rounded overflow-auto max-h-60 text-xs font-mono">
                    {JSON.stringify(node.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function WorkflowDebugView({ results, workflowType, className, onClose }: WorkflowDebugViewProps) {
  const [nodes, setNodes] = useState<NodeOutput[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  
  const nodeOrder = workflowType === 'flux_gen' 
    ? FLUX_NODE_ORDER 
    : workflowType === 'masking'
      ? MASKING_NODE_ORDER
      : workflowType === 'all_jewelry_masking'
        ? ALL_JEWELRY_MASKING_NODE_ORDER
        : ALL_JEWELRY_NODE_ORDER;
  
  // Process results into ordered nodes
  useEffect(() => {
    if (!results) {
      setNodes([]);
      return;
    }
    
    const processedNodes: NodeOutput[] = [];
    
    // First add nodes in order
    for (const nodeName of nodeOrder) {
      const nodeData = results[nodeName];
      if (!nodeData) continue;
      
      const data = Array.isArray(nodeData) && nodeData.length > 0 ? nodeData[0] : nodeData;
      const isImageNode = IMAGE_NODES.has(nodeName);
      
      processedNodes.push({
        nodeName,
        type: isImageNode ? 'image' : 'json',
        data,
        loading: isImageNode,
        resolvedImage: null,
      });
    }
    
    // Add any extra nodes not in our order
    for (const [nodeName, nodeData] of Object.entries(results)) {
      if (nodeOrder.includes(nodeName)) continue;
      const data = Array.isArray(nodeData) && nodeData.length > 0 ? nodeData[0] : nodeData;
      const isImageNode = IMAGE_NODES.has(nodeName);
      
      processedNodes.push({
        nodeName,
        type: isImageNode ? 'image' : 'json',
        data,
        loading: isImageNode,
        resolvedImage: null,
      });
    }
    
    setNodes(processedNodes);
    
    // Resolve images from Azure URIs
    processedNodes.forEach(async (node, index) => {
      if (node.type !== 'image') return;
      
      // Try to extract base64 first
      const base64 = extractBase64(node.data);
      if (base64) {
        setNodes(prev => prev.map((n, i) => 
          i === index ? { ...n, resolvedImage: base64, loading: false } : n
        ));
        return;
      }
      
      // Try Azure URI
      const azureUri = extractAzureUri(node.data);
      if (azureUri) {
        try {
          const { data, error } = await supabase.functions.invoke('azure-fetch-image', {
            body: { azure_uri: azureUri },
          });
          
          if (error) throw error;
          if (!data?.base64) throw new Error('No base64 in response');
          
          const imageData = `data:${data.content_type || 'image/png'};base64,${data.base64}`;
          setNodes(prev => prev.map((n, i) => 
            i === index ? { ...n, resolvedImage: imageData, loading: false } : n
          ));
        } catch (err) {
          setNodes(prev => prev.map((n, i) => 
            i === index ? { ...n, error: String(err), loading: false } : n
          ));
        }
      } else {
        setNodes(prev => prev.map((n, i) => 
          i === index ? { ...n, loading: false, error: 'No image data found' } : n
        ));
      }
    });
  }, [results, nodeOrder]);
  
  const toggleNode = (nodeName: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeName)) {
        next.delete(nodeName);
      } else {
        next.add(nodeName);
      }
      return next;
    });
  };
  
  const expandAll = () => {
    setExpandedNodes(new Set(nodes.map(n => n.nodeName)));
  };
  
  const collapseAll = () => {
    setExpandedNodes(new Set());
  };
  
  const imageNodes = nodes.filter(n => n.type === 'image');
  const jsonNodes = nodes.filter(n => n.type === 'json');
  
  return (
    <div className={cn("bg-background border rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">Workflow Debug View</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {workflowType === 'flux_gen' ? 'Flux Gen Pipeline' 
              : workflowType === 'masking' ? 'Masking Pipeline'
              : workflowType === 'all_jewelry_masking' ? 'All Jewelry Masking'
              : 'All Jewelry Generation'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'timeline' ? 'grid' : 'timeline')}
            className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
          >
            {viewMode === 'timeline' ? 'Grid View' : 'Timeline'}
          </button>
          <button
            onClick={expandAll}
            className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
          >
            Collapse All
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 max-h-[70vh] overflow-auto">
        {nodes.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No workflow results to display
          </div>
        ) : viewMode === 'timeline' ? (
          <div className="space-y-6">
            {/* Images Section */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                Image Outputs ({imageNodes.length})
              </h4>
              <div className="space-y-2">
                {imageNodes.map((node, index) => (
                  <div key={node.nodeName} className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-mono">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <NodeCard 
                        node={node} 
                        isExpanded={expandedNodes.has(node.nodeName)}
                        onToggle={() => toggleNode(node.nodeName)}
                        onImageClick={setLightboxImage}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* JSON Section */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <FileJson className="h-4 w-4 text-accent" />
                JSON/Text Outputs ({jsonNodes.length})
              </h4>
              <div className="space-y-2">
                {jsonNodes.map((node, index) => (
                  <div key={node.nodeName} className="flex items-start gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-xs font-mono">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <NodeCard 
                        node={node} 
                        isExpanded={expandedNodes.has(node.nodeName)}
                        onToggle={() => toggleNode(node.nodeName)}
                        onImageClick={setLightboxImage}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {nodes.map(node => (
              <NodeCard 
                key={node.nodeName}
                node={node} 
                isExpanded={expandedNodes.has(node.nodeName)}
                onToggle={() => toggleNode(node.nodeName)}
                onImageClick={setLightboxImage}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightboxImage}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={e => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
