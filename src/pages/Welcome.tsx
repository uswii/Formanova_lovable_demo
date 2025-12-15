import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Shield, Gem, Sparkles, Diamond } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Assets
import formanovaLogo from '@/assets/formanova-logo.png';
import necklaceGold from '@/assets/jewelry/necklace-gold.jpg';
import necklacePearl from '@/assets/jewelry/necklace-pearl.jpg';
import necklaceDiamond from '@/assets/jewelry/necklace-diamond.jpg';
import heroNecklace from '@/assets/jewelry/hero-necklace.jpg';

export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleStart = () => {
    if (user) {
      navigate('/studio');
    } else {
      navigate('/auth');
    }
  };

  const jewelryShowcase = [
    { src: necklaceGold, alt: 'Gold pendant necklace', label: 'Gold Collection' },
    { src: necklacePearl, alt: 'Pearl necklace', label: 'Pearl Elegance' },
    { src: necklaceDiamond, alt: 'Diamond pendant', label: 'Diamond Luxury' },
  ];

  return (
    <div className="min-h-screen formanova-gradient overflow-hidden">
      {/* Full-Width Video at Top - cropped from top */}
      <section className="w-full overflow-hidden">
        <div className="mt-[-8rem]">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto"
          >
            <source src="/videos/jewelry-showcase.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      {/* Hero Section */}
      <section className="relative py-20">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-[15%] w-3 h-3 rotate-45 border border-primary/20 animate-pulse" />
          <div className="absolute top-32 right-[20%] w-2 h-2 rotate-45 bg-primary/10" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-3xl" />
        </div>
        
        <div className="px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Jewelry indicator */}
            <div className="animate-fade-in flex items-center justify-center gap-3">
              <Diamond className="h-4 w-4 text-primary" />
              <span className="editorial-caps">Professional Jewelry Photography</span>
              <Diamond className="h-4 w-4 text-primary" />
            </div>

            {/* Main Headline */}
            <div className="space-y-6 animate-fade-in animation-delay-100">
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-light tracking-wide text-balance">
                Your Jewelry
                <span className="block italic text-primary formanova-text-glow">Perfectly Showcased</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                AI imagery you can trust. Your jewelry is always accurately shown. 
                No hallucinations. No subtle changes.
              </p>
            </div>

            {/* Trust Badge */}
            <div className="animate-fade-in animation-delay-200">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-primary/30 bg-card/50 backdrop-blur-sm formanova-glow">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Pixel-perfect preservation guaranteed
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in animation-delay-300">
              <Button 
                size="lg" 
                className="h-14 px-8 text-base font-medium tracking-wide formanova-glow"
                onClick={handleStart}
              >
                <Gem className="mr-2 h-4 w-4" />
                Start Your Photoshoot
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button 
                variant="outline" 
                size="lg"
                className="h-14 px-8 text-base font-medium tracking-wide group"
                onClick={() => navigate('/tutorial')}
              >
                <Play className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                Watch Tutorial
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in animation-delay-500">
          <div className="w-px h-16 bg-gradient-to-b from-primary/40 to-transparent" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 relative">
        <div className="container px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-20 space-y-4">
              <span className="editorial-caps">Why Jewelers Trust Us</span>
              <h2 className="font-display text-3xl md:text-4xl font-light">
                Results You Can Rely On
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-12 md:gap-8">
              {[
                {
                  icon: Shield,
                  title: 'Your Jewelry, Untouched',
                  description: 'No hallucinations. No subtle changes. Your product appears exactly as photographed, every single time.',
                },
                {
                  icon: Gem,
                  title: 'Effortless Precision',
                  description: 'Simply mark your jewelry and let our AI handle the rest. Professional results without the learning curve.',
                },
                {
                  icon: Sparkles,
                  title: 'Studio-Quality Results',
                  description: 'Get beautiful, professional imagery ready for your website, catalog, or social media in minutes.',
                },
              ].map((feature, index) => (
                <div 
                  key={feature.title}
                  className="text-center space-y-6 animate-fade-in group"
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-primary/30 bg-card/50 group-hover:formanova-glow transition-all duration-300">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-display text-xl font-medium">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-32 bg-secondary/30">
        <div className="container px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-20 space-y-4">
              <span className="editorial-caps">How It Works</span>
              <h2 className="font-display text-3xl md:text-4xl font-light">
                Three Simple Steps
              </h2>
            </div>

            <div className="space-y-16">
              {[
                {
                  step: '01',
                  title: 'Upload Your Photo',
                  description: 'Upload your jewelry image and mark the product you want to showcase.',
                },
                {
                  step: '02',
                  title: 'Segment the Jewelry',
                  description: 'AI automatically masks your jewelry with precision. Refine with simple brush tools.',
                },
                {
                  step: '03',
                  title: 'Generate Photoshoot',
                  description: 'Choose your model and generate professional photoshoot imagery in seconds.',
                },
              ].map((item, index) => (
                <div 
                  key={item.step}
                  className="flex items-start gap-8 animate-fade-in"
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <span className="font-display text-5xl md:text-6xl text-primary/30 font-light leading-none formanova-text-glow">
                    {item.step}
                  </span>
                  <div className="pt-2 space-y-2">
                    <h3 className="font-display text-xl md:text-2xl">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32">
        <div className="container px-6 text-center">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Diamond className="h-5 w-5 text-primary" />
              <Diamond className="h-3 w-3 text-primary/60" />
              <Diamond className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-light">
              Ready to Elevate Your Jewelry Photography?
            </h2>
            <p className="text-muted-foreground">
              Join jewelers who trust FormaNova for accurate, beautiful product imagery.
            </p>
            <Button 
              size="lg" 
              className="h-14 px-10 text-base font-medium tracking-wide formanova-glow"
              onClick={handleStart}
            >
              <Gem className="mr-2 h-4 w-4" />
              Start Creating
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border/50">
        {/* Featured In Section */}
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground mb-10 uppercase tracking-[0.2em]">
            Featured In
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16 mb-12">
            <span className="text-2xl md:text-3xl font-bold text-foreground/70">CNN</span>
            <span className="text-xl md:text-2xl font-semibold text-foreground/70">TechCrunch</span>
            <span className="text-lg md:text-xl font-medium text-foreground/70 uppercase tracking-wider">The Telegraph</span>
            <span className="text-xl md:text-2xl font-bold text-foreground/70">HuffPost</span>
          </div>
          
          <div className="w-32 h-px bg-border mx-auto mb-12" />
          
          <p className="font-display text-2xl text-foreground mb-10">
            Trusted By <span className="text-primary font-semibold">70+</span> Brands
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
            <span className="text-xl md:text-2xl font-bold tracking-wider text-foreground/60">HUGO BOSS</span>
            <span className="text-xl md:text-2xl font-light tracking-widest text-foreground/60">ATOIR</span>
            <span className="text-xl md:text-2xl italic font-light text-foreground/60">Tulleen</span>
            <span className="text-xl md:text-2xl font-bold tracking-wide text-foreground/60">MANGO</span>
          </div>
        </div>
        
        {/* Bottom Footer */}
        <div className="border-t border-border/30 px-6 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Logo */}
              <img 
                src={formanovaLogo} 
                alt="FormaNova" 
                className="h-8 w-auto object-contain logo-adaptive"
              />
              
              {/* Links */}
              <div className="flex items-center gap-6">
                <Link to="/studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Studio
                </Link>
                <Link to="/tutorial" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Tutorial
                </Link>
                <a 
                  href="https://linkedin.com/company/rare-sense-inc" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  LinkedIn
                </a>
              </div>
              
              {/* Copyright */}
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} FormaNova
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
