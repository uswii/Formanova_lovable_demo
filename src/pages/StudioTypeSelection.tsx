import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Users, Package, ArrowRight } from 'lucide-react';

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
    transition: { duration: 0.5 },
  },
};

const modes = [
  {
    id: 'model',
    title: 'Model Shot',
    description: 'Generate jewelry images worn by a model',
    Icon: Users,
    destination: '/studio/categories',
    bg: 'bg-gradient-to-br from-neutral-900 via-stone-900 to-neutral-800',
  },
  {
    id: 'product',
    title: 'Product Shot',
    description: 'Create clean product images for listings and PDPs',
    Icon: Package,
    destination: '/studio/categories',
    bg: 'bg-gradient-to-br from-zinc-800 via-neutral-700 to-stone-800',
  },
] as const;

export default function StudioTypeSelection() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)] bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 md:px-12 lg:px-16 py-8 md:py-10">
        <div className="w-full max-w-5xl">

          {/* Top label + heading */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-6 md:mb-8"
          >
            <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-2">
              Photo Studio
            </span>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl uppercase tracking-tight text-foreground leading-[0.9] mb-2">
              What do you want to create?
            </h1>
            <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase">
              Choose the type of image you want to generate
            </p>
          </motion.div>

          {/* Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5"
          >
            {modes.map((mode) => {
              const { Icon } = mode;
              return (
                <motion.button
                  key={mode.id}
                  variants={itemVariants}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(mode.destination)}
                  className={`group relative aspect-[4/3] marta-frame overflow-hidden cursor-pointer
                               transition-all duration-300
                               hover:border-formanova-hero-accent
                               hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)]
                               text-left ${mode.bg}`}
                >
                  {/* Subtle texture overlay */}
                  <div
                    className="absolute inset-0 opacity-[0.035]"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(0deg,currentColor 0,currentColor 1px,transparent 1px,transparent 36px),' +
                        'repeating-linear-gradient(90deg,currentColor 0,currentColor 1px,transparent 1px,transparent 36px)',
                    }}
                  />

                  {/* Centered icon badge */}
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div
                      className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
                                 bg-background/80 border border-border/60 shadow-lg
                                 backdrop-blur-sm
                                 group-hover:border-formanova-hero-accent
                                 group-hover:shadow-[0_0_16px_-2px_hsl(var(--formanova-hero-accent)/0.45)]
                                 transition-all duration-300"
                    >
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
                    </div>
                  </div>

                  {/* Bottom gradient */}
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

                  {/* Text content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-7 text-left">
                    <h2 className="font-display text-2xl md:text-3xl lg:text-4xl uppercase tracking-wide text-foreground
                                   transition-transform duration-300 group-hover:translate-x-1">
                      {mode.title}
                    </h2>
                    <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-1 max-w-xs">
                      {mode.description}
                    </p>
                  </div>

                  {/* Hover arrow */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                    <div className="w-9 h-9 flex items-center justify-center bg-formanova-hero-accent shadow-lg shadow-formanova-hero-accent/30">
                      <ArrowRight className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Footer note — dark */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="font-mono text-[9px] tracking-[0.2em] text-foreground/70 uppercase text-center"
          >
            You can switch between modes anytime in the Studio
          </motion.p>

        </div>
      </div>
    </div>
  );
}
