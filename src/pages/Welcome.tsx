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
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-[15%] w-3 h-3 rotate-45 border border-primary/20 animate-pulse" />
          <div className="absolute top-32 right-[20%] w-2 h-2 rotate-45 bg-primary/10" />
          <div className="absolute bottom-40 left-[10%] w-4 h-4 rotate-45 border border-primary/15" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container px-6 py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-10">
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

            {/* Video Showcase - Foreground */}
            <div className="animate-fade-in animation-delay-200 py-8 w-full max-w-4xl mx-auto">
              <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl bg-card">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full aspect-video object-cover"
                >
                  <source src="/videos/jewelry-showcase.mp4" type="video/mp4" />
                </video>
              </div>
              <p className="text-xs text-muted-foreground mt-4 uppercase tracking-widest text-center">
                See FormaNova in Action
              </p>
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
                  description: 'Upload your jewelry image and tap to mark the product you want to showcase.',
                },
                {
                  step: '02',
                  title: 'Perfect the Selection',
                  description: 'Use simple brush tools to refine exactly what should be included.',
                },
                {
                  step: '03',
                  title: 'Get Your Images',
                  description: 'Choose your model and receive professional results in seconds.',
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

      {/* Refined Footer */}
      <footer className="bg-card border-t border-border/50">
        {/* Main Footer Content */}
        <div className="px-6 py-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12 items-center">
              {/* Logo & Tagline */}
              <div className="text-center md:text-left">
                <img 
                  src={formanovaLogo} 
                  alt="FormaNova" 
                  className="h-10 md:h-12 w-auto object-contain logo-adaptive mx-auto md:mx-0 mb-4"
                />
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The only AI built specifically for jewelry photography. Trusted by jewelers worldwide.
                </p>
              </div>
              
              {/* Quick Links */}
              <div className="text-center">
                <h4 className="font-display text-lg mb-4">Quick Links</h4>
                <div className="flex flex-col gap-2">
                  <Link to="/studio" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                    Studio
                  </Link>
                  <Link to="/tutorial" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                    Tutorial
                  </Link>
                  <Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                    Sign In
                  </Link>
                </div>
              </div>
              
              {/* CTA */}
              <div className="text-center md:text-right">
                <h4 className="font-display text-lg mb-4">Ready to Start?</h4>
                <Button 
                  className="formanova-glow"
                  onClick={handleStart}
                >
                  <Gem className="mr-2 h-4 w-4" />
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="border-t border-border/30 px-6 py-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} FormaNova. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Pixel-perfect jewelry imagery, every time.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
