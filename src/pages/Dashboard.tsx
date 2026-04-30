import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrefetchGenerations } from '@/hooks/use-prefetch-generations';
import { useRecentGenerations } from '@/hooks/useRecentGenerations';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import type { WorkflowSummary } from '@/lib/generation-history-api';

import heroNecklace from '@/assets/jewelry/hero-necklace-diamond.webp';
import textToCadThumb from '@/assets/cad-studio-thumb.webp';

// ─── Session ────────────────────────────────────────────────────────

const STUDIO_SESSION_KEY = 'formanova_studio_session_v1';

interface RecentSession {
  jewelryType: string;
  mode: 'model-shot' | 'product-shot';
}

function readRecentSession(): RecentSession | null {
  try {
    const raw = sessionStorage.getItem(STUDIO_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.jewelryType || !session?.jewelryUploadedUrl) return null;
    const mode = (sessionStorage.getItem('formanova_studio_mode') ?? 'model-shot') as RecentSession['mode'];
    return { jewelryType: session.jewelryType, mode };
  } catch { return null; }
}

// ─── Constants ──────────────────────────────────────────────────────

const JEWELRY_DISPLAY: Record<string, string> = {
  necklace: 'Necklaces', necklaces: 'Necklaces',
  earrings: 'Earrings', earring: 'Earrings',
  rings: 'Rings', ring: 'Rings',
  bracelets: 'Bracelets', bracelet: 'Bracelets',
  watches: 'Watches', watch: 'Watches',
};

const CATEGORIES = [
  { id: 'necklace', label: 'Necklaces' },
  { id: 'earrings', label: 'Earrings' },
  { id: 'rings', label: 'Rings' },
  { id: 'bracelets', label: 'Bracelets' },
  { id: 'watches', label: 'Watches' },
] as const;

// ─── Animation variants ─────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// ─── Recent photo thumbnail ──────────────────────────────────────────

function RecentPhotoCard({ workflow }: { workflow: WorkflowSummary }) {
  const navigate = useNavigate();
  const thumb = useAuthenticatedImage(workflow.thumbnail_url ?? null);

  return (
    <button
      onClick={() => navigate('/generations')}
      className="group relative aspect-[4/3] marta-frame overflow-hidden w-full cursor-pointer hover:border-formanova-hero-accent transition-colors duration-300"
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/70 to-transparent" />
      <div className="absolute bottom-2 left-3">
        <span className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground uppercase">
          {workflow.source_type === 'product_shot' ? 'Product Shot' : 'Model Shot'}
        </span>
      </div>
    </button>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userName = user?.email ? user.email.split('@')[0] : '';

  usePrefetchGenerations();

  const recentSession = readRecentSession();
  const { workflows: recentPhotos, isLoading: photosLoading } = useRecentGenerations(6);
  const showRecentPhotos = photosLoading || recentPhotos.length > 0;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-6 md:px-12 lg:px-16">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* 1. Welcome header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-end justify-between"
        >
          <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase">
            {userName ? `Welcome, ${userName}` : 'Welcome'}
          </span>
          <p className="hidden md:block font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
            Choose your studio
          </p>
        </motion.div>

        {/* 2. Primary action tiles */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid md:grid-cols-2 gap-4"
        >
          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/studio')}
            className="group relative aspect-[4/3] marta-frame overflow-hidden cursor-pointer transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)] text-left"
          >
            <OptimizedImage
              src={heroNecklace}
              alt="Photo Studio"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-4xl lg:text-5xl uppercase tracking-wide text-foreground transition-transform duration-300 group-hover:translate-x-1">
                Photo Studio
              </h2>
              <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-2 max-w-xs">
                Upload jewelry photos · Generate on-model imagery
              </p>
            </div>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0 translate-x-2">
              <div className="w-9 h-9 flex items-center justify-center bg-formanova-hero-accent shadow-lg shadow-formanova-hero-accent/30">
                <ArrowRight className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          </motion.button>

          <motion.button
            variants={itemVariants}
            onClick={() => navigate('/studio-cad')}
            className="group relative aspect-[4/3] marta-frame overflow-hidden text-left cursor-pointer transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)]"
          >
            <OptimizedImage
              src={textToCadThumb}
              alt="CAD Studio"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
              <h2 className="font-display text-2xl md:text-4xl lg:text-5xl uppercase tracking-wide text-foreground">
                CAD Studio
              </h2>
              <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-2">
                Generate text-to-CAD models and catalog visuals
              </p>
            </div>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
              <div className="w-8 h-8 flex items-center justify-center bg-formanova-hero-accent shadow-lg shadow-formanova-hero-accent/30">
                <ArrowRight className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* 3. Continue Recent Work — only shown when a studio session exists */}
        {recentSession && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="marta-frame px-5 py-4 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">
                Continue where you left off
              </span>
              <p className="font-mono text-sm text-foreground truncate">
                {JEWELRY_DISPLAY[recentSession.jewelryType] ?? recentSession.jewelryType}
                {' '}·{' '}
                {recentSession.mode === 'model-shot' ? 'Model Shot' : 'Product Shot'}
              </p>
            </div>
            <button
              onClick={() => navigate(`/studio/${recentSession.jewelryType}`, { state: { mode: recentSession.mode } })}
              className="flex-none flex items-center gap-2 px-5 py-2.5 bg-formanova-hero-accent text-primary-foreground font-mono text-[10px] tracking-[0.2em] uppercase whitespace-nowrap hover:opacity-90 transition-opacity"
            >
              Continue
              <ArrowRight className="h-3 w-3" />
            </button>
          </motion.div>
        )}

        {/* 4. Recent Generated Photos */}
        {showRecentPhotos && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase">
                Recent Generated Photos
              </span>
              <Link
                to="/generations"
                className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground transition-colors flex items-center gap-1"
              >
                View all
                <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>

            {photosLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/3] w-full" />
                ))}
              </div>
            ) : (
              <>
                {/* Mobile: horizontal scroll strip */}
                <div className="flex md:hidden gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-6 px-6">
                  {recentPhotos.map(w => (
                    <div key={w.workflow_id} className="flex-none w-[72%] snap-start">
                      <RecentPhotoCard workflow={w} />
                    </div>
                  ))}
                </div>
                {/* Desktop: 3-col grid */}
                <div className="hidden md:grid md:grid-cols-3 gap-4">
                  {recentPhotos.map(w => (
                    <RecentPhotoCard key={w.workflow_id} workflow={w} />
                  ))}
                </div>
              </>
            )}
          </motion.section>
        )}

        {/* 5. Quick Category Access */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="pb-6"
        >
          <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-4">
            Quick Category Access
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate('/studio')}
                className="flex-none px-5 py-2.5 border border-border/30 text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase whitespace-nowrap hover:border-formanova-hero-accent hover:text-foreground transition-colors"
              >
                {cat.label}
              </button>
            ))}
          </div>
        </motion.section>

      </div>
    </div>
  );
}
