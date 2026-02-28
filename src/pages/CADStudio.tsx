import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Box } from "lucide-react";
import InteractiveRing from "@/components/cad/InteractiveRing";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
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

const cadFeatures = [
  {
    title: "Text → CAD",
    description: "Generate detailed jewelry CAD concepts from text prompts.",
    icon: Sparkles,
    route: "/text-to-cad",
    comingSoon: false,
  },
  {
    title: "CAD → Catalog",
    description: "Turn your CAD files into realistic product visuals and catalog-ready images.",
    icon: Box,
    route: "/cad-to-catalog",
    comingSoon: true,
  },
];

export default function CADStudio() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-6 px-6 md:px-12 lg:px-16">
      {/* Header — matches /studio */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto mb-6 flex items-end justify-between"
      >
        <div>
          <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground uppercase block mb-1">
            CAD Studio
          </span>
        </div>
        <p className="hidden md:block font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase">
          3D design tools
        </p>
      </motion.div>

      {/* Grid — 3 columns matching /studio rhythm */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-4"
      >
        {/* 3D Ring Preview tile */}
        <motion.div
          variants={itemVariants}
          className="relative aspect-[4/3] marta-frame overflow-hidden"
        >
          <InteractiveRing />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6 pointer-events-none">
            <h2 className="font-display text-xl md:text-2xl lg:text-3xl uppercase tracking-wide text-foreground">
              3D Preview
            </h2>
          </div>
        </motion.div>

        {/* Feature tiles */}
        {cadFeatures.map((feature) => {
          const Icon = feature.icon;

          if (feature.comingSoon) {
            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className="group relative aspect-[4/3] marta-frame overflow-hidden text-left opacity-50 pointer-events-none"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className="w-24 h-24 text-muted-foreground/10" strokeWidth={0.5} />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent" />

                <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6 text-left">
                  <h2 className="font-display text-xl md:text-2xl lg:text-3xl uppercase tracking-wide text-foreground">
                    {feature.title}
                  </h2>
                  <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-1 max-w-xs">
                    {feature.description}
                  </p>
                </div>

                <div className="absolute top-4 right-4">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground uppercase bg-muted/80 backdrop-blur-sm px-3 py-1.5">
                    Coming Soon
                  </span>
                </div>
              </motion.div>
            );
          }

          return (
            <motion.button
              key={feature.title}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(feature.route)}
              className="group relative aspect-[4/3] marta-frame overflow-hidden cursor-pointer transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)] text-left"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon className="w-24 h-24 text-muted-foreground/10 transition-transform duration-500 group-hover:scale-110" strokeWidth={0.5} />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/80 to-transparent" />

              <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6">
                <h2 className="font-display text-xl md:text-2xl lg:text-3xl uppercase tracking-wide text-foreground transition-transform duration-300 group-hover:translate-x-1">
                  {feature.title}
                </h2>
                <p className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground uppercase mt-1 max-w-xs">
                  {feature.description}
                </p>
              </div>

              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0 translate-x-2">
                <div className="w-9 h-9 flex items-center justify-center bg-formanova-hero-accent shadow-lg shadow-formanova-hero-accent/30">
                  <ArrowRight className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
