import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Layers, ImageIcon, Diamond } from "lucide-react";

import textToCadImg from "@/assets/text-to-cad-thumb.jpg";
import imageToCadImg from "@/assets/examples/cad-example-1.webp";
import cadToPdpImg from "@/assets/cad-studio/cad-to-catalog-card.webp";
import cadToCatalogImg from "@/assets/cad-studio/cad-to-catalog-ring.webp";

const cadFeatures = [
  {
    title: "Text to CAD",
    description: "Generate jewelry CAD concepts from text prompts.",
    route: "/text-to-cad",
    comingSoon: false,
    icon: Layers,
    image: textToCadImg,
  },
  {
    title: "Image to CAD",
    description: "Upload a photo or sketch and generate a 3D ring from your design.",
    route: "/image-to-cad",
    comingSoon: false,
    icon: ImageIcon,
    image: imageToCadImg,
  },
  {
    title: "CAD to PDP",
    description: "Turn your 3D ring file into studio-ready product images.",
    route: "/cad-to-pdp",
    comingSoon: false,
    icon: Diamond,
    image: cadToPdpImg,
  },
  {
    title: "CAD to Catalog",
    description: "Transform your CAD designs into polished catalog-ready visuals.",
    route: "/cad-to-catalog",
    comingSoon: false,
    icon: ImageIcon,
    image: cadToCatalogImg,
  },
];

export default function CADStudio() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-background flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 lg:px-10 overflow-x-hidden pt-4 md:pt-8 lg:pt-0">
      {/* Header */}
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="font-display text-4xl md:text-5xl lg:text-8xl uppercase tracking-wide text-center pt-3 md:pt-5 lg:pt-4 text-foreground leading-none mb-4 md:mb-5"
      >
        CAD <span className="hero-accent-text">Studio</span>
      </motion.h1>

      {/* Feature Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="w-full max-w-[1200px] grid grid-cols-2 gap-3 md:gap-4 pb-4 md:pb-6"
      >
        {cadFeatures.map((feature) => {
          const Icon = feature.icon;

          if (feature.comingSoon) {
            return (
              <div
                key={feature.title}
                className="group relative marta-frame overflow-hidden aspect-[16/9] opacity-60 cursor-default"
              >
                <img
                  src={feature.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="absolute top-2.5 left-2.5">
                  <Icon className="w-4 h-4 text-formanova-hero-accent/60" />
                </div>

                <div className="absolute top-2.5 right-2.5">
                  <span className="font-mono text-[7px] tracking-[0.2em] text-muted-foreground uppercase bg-muted/80 backdrop-blur-sm px-2 py-0.5">
                    Coming Soon
                  </span>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                  <h2 className="font-display text-2xl md:text-3xl lg:text-[40px] uppercase tracking-wide text-white leading-none">
                    {feature.title}
                  </h2>
                  <p className="font-mono text-[8px] md:text-[9px] tracking-[0.15em] text-white/60 uppercase mt-2">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <motion.button
              key={feature.title}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate(feature.route)}
              className="group relative marta-frame overflow-hidden aspect-[16/9] cursor-pointer text-left transition-all duration-300 hover:border-formanova-hero-accent hover:shadow-[0_0_30px_-5px_hsl(var(--formanova-hero-accent)/0.4)]"
            >
              <img
                src={feature.image}
                alt={feature.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

              <div className="absolute top-2.5 left-2.5">
                <Icon className="w-4 h-4 text-formanova-hero-accent" />
              </div>

              <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                <div className="w-6 h-6 flex items-center justify-center bg-formanova-hero-accent shadow-lg shadow-formanova-hero-accent/30">
                  <ArrowRight className="w-3 h-3 text-primary-foreground" />
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                <h2 className="font-display text-2xl md:text-3xl lg:text-[40px] uppercase tracking-wide text-white leading-none transition-transform duration-300 group-hover:translate-x-0.5">
                  {feature.title}
                </h2>
                <p className="font-mono text-[8px] md:text-[9px] tracking-[0.15em] text-white/60 uppercase mt-2">
                  {feature.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
