import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Box } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const userName = user?.email ? user.email.split('@')[0] : '';

  return (
    <div className="min-h-screen bg-background">
      <div className="marta-container py-16 md:py-24">
        {/* Header */}
        <motion.div 
          className="mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="marta-label mb-2">Welcome{userName ? `, ${userName}` : ''}</p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight">
            Create Your Photoshoot
          </h1>
        </motion.div>

        {/* Main Pathways */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* From Jewelry Photos */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="group cursor-pointer"
            onClick={() => navigate('/studio')}
          >
            <div className="relative overflow-hidden rounded-sm border border-border/50 bg-card/30 backdrop-blur-sm p-8 md:p-10 h-full transition-all duration-500 hover:border-primary/50 hover:bg-card/50">
              <div className="flex items-start justify-between mb-8">
                <div className="p-4 rounded-sm bg-primary/10">
                  <Camera className="h-8 w-8 text-primary" />
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
              </div>
              
              <h2 className="font-display text-2xl md:text-3xl mb-3">From Jewelry Photos</h2>
              <p className="text-muted-foreground mb-6">
                Upload photos of real jewelry (model or mannequin).
                <br />
                Generate professional on-model e-commerce images.
              </p>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-foreground/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Mannequin to model conversion</span>
                </div>
                <div className="flex items-center gap-3 text-foreground/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>Professional product photography</span>
                </div>
                <div className="flex items-center gap-3 text-foreground/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>E-commerce ready output</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* From Jewelry CAD */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="group cursor-pointer opacity-60"
            onClick={() => {}}
          >
            <div className="relative overflow-hidden rounded-sm border border-border/50 bg-card/30 backdrop-blur-sm p-8 md:p-10 h-full transition-all duration-500">
              <div className="absolute top-4 right-4">
                <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                  Coming Soon
                </span>
              </div>
              
              <div className="flex items-start justify-between mb-8">
                <div className="p-4 rounded-sm bg-muted/30">
                  <Box className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              
              <h2 className="font-display text-2xl md:text-3xl mb-3 text-muted-foreground">From Jewelry CAD</h2>
              <p className="text-muted-foreground/70 mb-6">
                Upload CAD or digital jewelry designs.
                <br />
                Create realistic on-model e-commerce photoshoots.
              </p>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-muted-foreground/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  <span>3D CAD rendering</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  <span>Photorealistic output</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  <span>Multiple angle generation</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}