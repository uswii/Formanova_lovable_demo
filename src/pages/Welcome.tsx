import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Shield, Gem, Sparkles, Diamond } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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

  return (
    <div className="min-h-screen formanova-gradient overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center">
        {/* Decorative jewelry-inspired elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating diamond shapes */}
          <div className="absolute top-20 left-[15%] w-3 h-3 rotate-45 border border-primary/20 animate-pulse" />
          <div className="absolute top-32 right-[20%] w-2 h-2 rotate-45 bg-primary/10" />
          <div className="absolute bottom-40 left-[10%] w-4 h-4 rotate-45 border border-primary/15" />
          <div className="absolute top-1/3 right-[8%] w-2 h-2 rotate-45 bg-primary/20" />
          
          {/* Elegant gradient orbs */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
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

            {/* Visual showcase - jewelry silhouettes */}
            <div className="animate-fade-in animation-delay-200 py-8">
              <div className="flex items-center justify-center gap-8 md:gap-16 opacity-60">
                <div className="text-center">
                  <div className="w-16 h-20 md:w-20 md:h-24 mx-auto border border-primary/30 rounded-full relative">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-10 border border-primary/30 rounded-full" />
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-primary/40" />
                  </div>
                  <span className="text-xs text-muted-foreground mt-2 block">Necklaces</span>
                </div>
                <div className="text-center opacity-40">
                  <div className="w-12 h-12 md:w-14 md:h-14 mx-auto border border-muted-foreground/30 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 border border-muted-foreground/30 rounded-full" />
                  </div>
                  <span className="text-xs text-muted-foreground mt-2 block">Rings</span>
                  <span className="text-[10px] text-muted-foreground/60">Coming soon</span>
                </div>
                <div className="text-center opacity-40">
                  <div className="w-10 h-14 md:w-12 md:h-16 mx-auto border border-muted-foreground/30 rounded-lg relative">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-2 border border-muted-foreground/30 rounded-full" />
                  </div>
                  <span className="text-xs text-muted-foreground mt-2 block">Earrings</span>
                  <span className="text-[10px] text-muted-foreground/60">Coming soon</span>
                </div>
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
            {/* Section Header */}
            <div className="text-center mb-20 space-y-4">
              <span className="editorial-caps">Why Jewelers Trust Us</span>
              <h2 className="font-display text-3xl md:text-4xl font-light">
                Results You Can Rely On
              </h2>
            </div>

            {/* Feature Grid */}
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

      {/* Footer */}
      <footer className="py-8 border-t border-border/40">
        <div className="container px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Diamond className="h-4 w-4 text-primary" />
              <span className="font-display tracking-wide">FormaNova</span>
            </div>
            <p className="text-center md:text-right">The only AI built for jewelry photography</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
