import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Camera, Gem, ArrowRight } from 'lucide-react';

interface StudioOption {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  route: string;
  status: 'active' | 'coming-soon';
}

const studios: StudioOption[] = [
  {
    id: 'photography',
    name: 'Photography Studio',
    subtitle: 'AI-powered try-on',
    description: 'Transform mannequin shots into stunning model photos with AI',
    icon: Camera,
    route: '/studio/photography',
    status: 'active',
  },
  {
    id: 'cad',
    name: 'CAD Studio',
    subtitle: 'Design to reality',
    description: 'Convert CAD renders into photorealistic jewelry images',
    icon: Gem,
    route: '/studio/cad',
    status: 'coming-soon',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
    },
  },
};

const StudioSelection = () => {
  const navigate = useNavigate();

  const handleStudioClick = (studio: StudioOption) => {
    if (studio.status === 'active') {
      navigate(studio.route);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-12 px-6 md:px-12 lg:px-16 flex flex-col items-center justify-center">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase block mb-2">
          Choose Your Workspace
        </span>
        <h1 className="font-display text-4xl md:text-5xl uppercase tracking-tight text-foreground">
          Creative <span className="text-formanova-hero-accent">Studios</span>
        </h1>
      </motion.div>

      {/* Studio Options */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {studios.map((studio) => {
          const Icon = studio.icon;
          const isActive = studio.status === 'active';
          
          return (
            <motion.button
              key={studio.id}
              variants={itemVariants}
              onClick={() => handleStudioClick(studio)}
              disabled={!isActive}
              className={`group relative marta-frame p-8 md:p-10 text-left transition-all duration-300 ${
                isActive 
                  ? 'cursor-pointer hover:border-foreground/50 hover:bg-muted/30' 
                  : 'cursor-not-allowed opacity-60'
              }`}
            >
              {/* Icon */}
              <div className={`w-14 h-14 mb-6 flex items-center justify-center ${
                isActive ? 'bg-formanova-hero-accent' : 'bg-muted'
              }`}>
                <Icon className={`w-7 h-7 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              </div>

              {/* Content */}
              <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase block mb-2">
                {studio.subtitle}
              </span>
              <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wide text-foreground mb-3">
                {studio.name}
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {studio.description}
              </p>

              {/* Status Badge */}
              {!isActive && (
                <div className="absolute top-4 right-4">
                  <span className="font-mono text-[8px] tracking-[0.2em] uppercase px-3 py-1 bg-muted text-muted-foreground">
                    Coming Soon
                  </span>
                </div>
              )}

              {/* Arrow indicator */}
              {isActive && (
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="w-9 h-9 flex items-center justify-center bg-formanova-hero-accent">
                    <ArrowRight className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};

export default StudioSelection;
