import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, Package, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const modes = [
  {
    id: 'model',
    title: 'Model Shot',
    description: 'Generate jewelry images worn by a model',
    Icon: Users,
    destination: '/studio/categories',
    placeholderClass: 'bg-gradient-to-br from-neutral-800 to-neutral-900',
    gridOpacity: 0.04,
  },
  {
    id: 'product',
    title: 'Product Shot',
    description: 'Create clean product images for listings and PDPs',
    Icon: Package,
    destination: '/studio/categories',
    placeholderClass: 'bg-gradient-to-br from-muted to-muted/50',
    gridOpacity: 0.06,
  },
] as const;

export default function StudioTypeSelection() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)] bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 md:px-12 lg:px-16 py-10 md:py-12">
        <div className="w-full max-w-2xl lg:max-w-3xl">

          {/* Top breadcrumb label */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-5"
          >
            <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase">
              Photo Studio
            </span>
          </motion.div>

          {/* Hero heading */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.07 }}
            className="mb-8 md:mb-10"
          >
            <h1 className="font-display text-3xl md:text-4xl lg:text-[3.5rem] uppercase tracking-tight text-foreground leading-[0.9] mb-3">
              What do you want to create?
            </h1>
            <p className="font-body text-sm text-muted-foreground">
              Choose the type of image you want to generate
            </p>
          </motion.div>

          {/* Mode cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
          >
            {modes.map((mode) => {
              const { Icon } = mode;
              return (
                <motion.div
                  key={mode.id}
                  variants={itemVariants}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="group marta-frame cursor-pointer transition-all duration-300
                             hover:border-formanova-hero-accent
                             hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)]"
                  onClick={() => navigate(mode.destination)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(mode.destination)}
                >
                  {/* Media placeholder area */}
                  <div className={`relative aspect-[2/1] overflow-hidden ${mode.placeholderClass}`}>
                    {/* Subtle grid pattern */}
                    <div
                      className="absolute inset-0"
                      style={{
                        opacity: mode.gridOpacity,
                        backgroundImage:
                          'repeating-linear-gradient(0deg, currentColor 0, currentColor 1px, transparent 1px, transparent 40px),' +
                          'repeating-linear-gradient(90deg, currentColor 0, currentColor 1px, transparent 1px, transparent 40px)',
                      }}
                    />
                    {/* Gradient overlay — from-transparent to card surface for a soft content merge */}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/20 to-transparent" />
                  </div>

                  {/* Icon badge — overlapping image / content boundary */}
                  <div className="relative">
                    <div className="absolute -top-5 left-6 z-10">
                      <div
                        className="w-10 h-10 flex items-center justify-center bg-background border border-border
                                   shadow-sm transition-all duration-300
                                   group-hover:border-formanova-hero-accent
                                   group-hover:shadow-[0_0_12px_-2px_hsl(var(--formanova-hero-accent)/0.35)]"
                      >
                        <Icon className="w-[15px] h-[15px] text-foreground" />
                      </div>
                    </div>

                    {/* Content block */}
                    <div className="px-6 pt-9 pb-6">
                      <h2
                        className="font-display text-xl md:text-2xl uppercase tracking-wide text-foreground
                                   mb-2 transition-transform duration-300 group-hover:translate-x-0.5"
                      >
                        {mode.title}
                      </h2>
                      <p className="font-body text-sm text-muted-foreground leading-relaxed text-justify mb-5">
                        {mode.description}
                      </p>
                      <Button
                        variant="default"
                        size="default"
                        className="w-full px-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(mode.destination);
                        }}
                      >
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Footer note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.42 }}
            className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase text-center"
          >
            You can switch between modes anytime in the Studio
          </motion.p>

        </div>
      </div>
    </div>
  );
}
