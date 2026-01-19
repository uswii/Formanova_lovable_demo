import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Gem, Box, Image, Coins, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const firstName = user?.email ? user.email.split('@')[0] : 'there';

  const fromPhotoOptions = [
    {
      title: 'Mannequin Input',
      description: 'Transform mannequin photos into stunning model shoots',
      path: '/studio/necklace',
      icon: Camera,
    },
    {
      title: 'Human Model',
      description: 'Enhance existing model photography',
      path: '/studio/necklace',
      icon: Sparkles,
    },
  ];

  const fromCADOptions = [
    {
      title: 'E-com Photoshoot',
      description: 'Turn CAD renders into product photography',
      path: '/studio/necklace',
      icon: Gem,
    },
    {
      title: '3D to Photoshoot',
      description: 'Convert 3D assets into lifestyle imagery',
      path: '/studio/necklace',
      icon: Box,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="marta-container py-12 md:py-20">
        {/* Welcome Header */}
        <motion.div 
          className="mb-16 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-muted-foreground uppercase tracking-[0.3em] text-sm mb-4">
            Welcome back
          </p>
          <h1 className="text-4xl md:text-6xl font-display mb-4">
            {firstName}
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Start creating stunning jewelry photoshoots
          </p>
        </motion.div>

        {/* From Photo Section */}
        <motion.section 
          className="mb-16"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-8">
            <span className="marta-label">From Photo</span>
            <h2 className="text-2xl md:text-3xl font-display mt-2">
              Transform Your Photography
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {fromPhotoOptions.map((option, index) => (
              <motion.div
                key={option.title}
                variants={itemVariants}
                className="group relative overflow-hidden rounded-lg border border-border/50 bg-card/30 backdrop-blur-sm p-8 cursor-pointer transition-all duration-500 hover:border-primary/50 hover:bg-card/50"
                onClick={() => navigate(option.path)}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <option.icon className="h-8 w-8 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-xl md:text-2xl font-display mb-2">{option.title}</h3>
                <p className="text-muted-foreground">{option.description}</p>
                
                {/* Decorative gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* From CAD Section */}
        <motion.section 
          className="mb-16"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-8">
            <span className="marta-label">From CAD</span>
            <h2 className="text-2xl md:text-3xl font-display mt-2">
              Bring Designs to Life
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {fromCADOptions.map((option, index) => (
              <motion.div
                key={option.title}
                variants={itemVariants}
                className="group relative overflow-hidden rounded-lg border border-border/50 bg-card/30 backdrop-blur-sm p-8 cursor-pointer transition-all duration-500 hover:border-primary/50 hover:bg-card/50"
                onClick={() => navigate(option.path)}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <option.icon className="h-8 w-8 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-xl md:text-2xl font-display mb-2">{option.title}</h3>
                <p className="text-muted-foreground">{option.description}</p>
                
                {/* Decorative gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Quick Actions */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              variants={itemVariants}
              className="group flex items-center gap-6 p-6 rounded-lg border border-border/30 bg-card/20 cursor-pointer transition-all duration-300 hover:border-primary/30 hover:bg-card/30"
              onClick={() => navigate('/generations')}
            >
              <div className="p-3 rounded-full bg-muted/50">
                <Image className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg">My Generations</h3>
                <p className="text-sm text-muted-foreground">View your previous creations</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="group flex items-center gap-6 p-6 rounded-lg border border-border/30 bg-card/20 cursor-pointer transition-all duration-300 hover:border-primary/30 hover:bg-card/30"
              onClick={() => navigate('/credits')}
            >
              <div className="p-3 rounded-full bg-muted/50">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg">Credits & Usage</h3>
                <p className="text-sm text-muted-foreground">Check your available credits</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </motion.div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
