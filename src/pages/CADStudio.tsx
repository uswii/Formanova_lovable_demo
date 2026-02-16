import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Box, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import InteractiveRing from "@/components/cad/InteractiveRing";

const cadFeatures = [
  {
    title: "CAD → Catalog",
    description:
      "Turn your CAD files into realistic product visuals and catalog-ready images.",
    icon: Box,
    route: "/cad-to-catalog",
  },
  {
    title: "Text → CAD",
    description:
      "Generate detailed jewelry CAD concepts from text prompts.",
    icon: Sparkles,
    route: "/text-to-cad",
  },
];

export default function CADStudio() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 sm:px-6">
        {/* Subtitle above ring */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="text-xs sm:text-sm tracking-[0.35em] uppercase text-muted-foreground/50 mt-16 mb-0 z-20"
        >
          CAD Studio
        </motion.p>

        {/* 3D Ring + overlapping title */}
        <div className="relative w-[650px] h-[650px] max-w-full mx-auto -mt-2">
          <InteractiveRing />
          {/* Large title overlaying the ring */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <span
              className="font-display text-[clamp(3rem,10vw,7rem)] leading-none tracking-wide"
              style={{
                background: "linear-gradient(180deg, hsl(var(--foreground) / 0.9), hsl(var(--muted-foreground) / 0.5))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              CAD Studio
            </span>
          </motion.h1>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl -mt-4 mb-20">
          {cadFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 + 0.15 * i }}
              whileHover={{ y: -4, scale: 1.01 }}
              className="group relative rounded-xl overflow-hidden flex flex-col items-center text-center p-8 bg-card border border-border/50 hover:border-border transition-colors"
            >
              <div className="w-14 h-14 rounded-xl bg-muted/10 flex items-center justify-center mb-5 group-hover:bg-muted/20 transition-colors">
                <feature.icon className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {feature.title}
              </h2>
              <p className="text-muted-foreground/60 mb-6 leading-relaxed text-sm">
                {feature.description}
              </p>
              <Button
                variant="secondary"
                className="w-full mt-auto"
                size="lg"
                onClick={() => navigate(feature.route)}
              >
                Open Studio →
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
