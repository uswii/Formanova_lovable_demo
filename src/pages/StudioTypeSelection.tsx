import { motion, type Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Package, Users } from 'lucide-react';

import productShotImg from '@/assets/cad-studio/cad-to-catalog-card.webp';
import modelShotImg from '@/assets/jewelry/hero-vneck-necklace.webp';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.14 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: 'easeOut' },
  },
};

const modes = [
  {
    id: 'model',
    title: 'MODEL SHOT',
    description: 'Generate jewelry images worn by a model',
    Icon: Users,
    destination: '/studio/categories',
    image: modelShotImg,
    imageClassName: 'object-cover object-center scale-[1.02] group-hover:scale-[1.06]',
    glowClassName: 'group-hover:shadow-[0_24px_60px_-28px_hsl(var(--formanova-hero-accent)/0.45)]',
  },
  {
    id: 'product',
    title: 'PRODUCT SHOT',
    description: 'Create clean product images for listings and PDPs',
    Icon: Package,
    destination: '/studio/categories',
    image: productShotImg,
    imageClassName: 'object-cover object-center group-hover:scale-[1.05]',
    glowClassName: 'group-hover:shadow-[0_24px_60px_-28px_hsl(var(--foreground)/0.22)]',
  },
] as const;

export default function StudioTypeSelection() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-10 md:px-8 lg:min-h-[calc(100vh-5rem)] lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,currentColor 0,currentColor 1px,transparent 1px,transparent 48px),' +
                'repeating-linear-gradient(90deg,currentColor 0,currentColor 1px,transparent 1px,transparent 48px)',
            }}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-muted/50 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-muted/40 via-transparent to-transparent" />

        <div className="relative mx-auto flex w-full max-w-[1120px] flex-col items-center">

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="mx-auto mb-12 flex max-w-[760px] flex-col items-center text-center sm:mb-14 lg:mb-16"
          >
            <span className="mb-2 font-mono text-[10px] tracking-[0.32em] text-muted-foreground uppercase">
              PHOTO STUDIO
            </span>
            <h1 className="max-w-[11ch] font-display text-[3.25rem] leading-[0.88] tracking-[0.02em] text-foreground sm:text-[4.25rem] lg:text-[5.4rem]">
              WHAT DO YOU WANT TO CREATE?
            </h1>
            <p className="mt-3 max-w-[52ch] font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase sm:text-[11px]">
              CHOOSE THE TYPE OF IMAGE YOU WANT TO GENERATE
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid w-full grid-cols-1 justify-items-center gap-8 md:gap-9 lg:grid-cols-2 lg:gap-10"
          >
            {modes.map((mode, index) => {
              const { Icon } = mode;

              return (
                <motion.button
                  key={mode.id}
                  variants={itemVariants}
                  whileHover={{ y: -6 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => navigate(mode.destination)}
                  className={cn(
                    'group relative flex h-[340px] w-full max-w-[520px] flex-col overflow-hidden border border-border/80 bg-card text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'sm:h-[352px] md:h-[332px] lg:h-[348px]',
                    'hover:border-formanova-hero-accent/70 hover:bg-card',
                    mode.glowClassName,
                  )}
                >
                  <div className="relative h-[61%] overflow-hidden border-b border-border/70 bg-muted/20">
                    <OptimizedImage
                      src={mode.image}
                      alt={mode.title}
                      priority={index === 0}
                      className={cn(
                        'absolute inset-0 h-full w-full transition-transform duration-700 ease-out',
                        mode.imageClassName,
                      )}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 via-black/5 to-transparent" />
                  </div>

                  <div className="pointer-events-none absolute left-1/2 top-[61%] z-10 -translate-x-1/2 -translate-y-1/2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background shadow-[0_10px_30px_-18px_hsl(var(--foreground)/0.45)] transition-all duration-300 group-hover:border-formanova-hero-accent/70 group-hover:shadow-[0_16px_36px_-18px_hsl(var(--formanova-hero-accent)/0.45)]">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                  </div>

                  <div className="relative flex min-h-0 flex-1 flex-col items-start justify-end px-6 pb-6 pt-10 sm:px-7 sm:pb-7 sm:pt-11">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
                    <h2 className="font-display text-[2rem] leading-none tracking-[0.06em] text-foreground sm:text-[2.3rem]">
                      {mode.title}
                    </h2>
                    <p className="mt-2 max-w-[28ch] font-body text-[14px] leading-6 text-muted-foreground">
                      {mode.description}
                    </p>

                    <span
                      className={cn(
                        buttonVariants({ variant: 'default', size: 'lg' }),
                        'mt-6 h-11 px-6 font-mono text-[10px] uppercase tracking-[0.22em] shadow-none transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground',
                      )}
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Footer note — dark */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-10 text-center font-mono text-[9px] tracking-[0.24em] text-muted-foreground uppercase sm:mt-12"
          >
            YOU CAN SWITCH BETWEEN MODES ANYTIME IN THE STUDIO
          </motion.p>

        </div>
      </div>
    </div>
  );
}
