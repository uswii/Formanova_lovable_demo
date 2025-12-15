import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Shield, Gem, Sparkles } from 'lucide-react';
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
        {/* Subtle gradient orb */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="container px-6 py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-12">
            {/* Editorial Label */}
            <div className="animate-fade-in">
              <span className="editorial-caps">AI-Powered Jewelry Photography</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-6 animate-fade-in animation-delay-100">
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-light tracking-wide text-balance">
                Transform Your
                <span className="block italic text-primary">Jewelry</span>
                Into Art
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                Professional photoshoots in minutes. Your product, pixel-perfect preserved.
              </p>
            </div>

            {/* Trust Badge */}
            <div className="animate-fade-in animation-delay-200">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-border/60 bg-card/40 backdrop-blur-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Non-composite technology — your jewelry is never modified
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in animation-delay-300">
              <Button 
                size="lg" 
                className="h-14 px-8 text-base font-medium tracking-wide"
                onClick={handleStart}
              >
                Begin Creating
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button 
                variant="ghost" 
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
          <div className="w-px h-16 bg-gradient-to-b from-border to-transparent" />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 relative">
        <div className="container px-6">
          <div className="max-w-5xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-20 space-y-4">
              <span className="editorial-caps">Why FormaNova</span>
              <h2 className="font-display text-3xl md:text-4xl font-light">
                Precision Meets Elegance
              </h2>
            </div>

            {/* Feature Grid */}
            <div className="grid md:grid-cols-3 gap-12 md:gap-8">
              {[
                {
                  icon: Shield,
                  title: 'Pixel-Perfect Preservation',
                  description: 'Non-composite mode ensures your jewelry remains exactly as photographed. No AI modifications to your product—ever.',
                },
                {
                  icon: Gem,
                  title: 'Intelligent Masking',
                  description: 'Advanced SAM technology with BiRefNet background removal. Precision metrics verify every generation.',
                },
                {
                  icon: Sparkles,
                  title: 'Dual Output Quality',
                  description: 'Receive both standard and enhanced results. Gemini-refined backgrounds with perfect alignment.',
                },
              ].map((feature, index) => (
                <div 
                  key={feature.title}
                  className="text-center space-y-6 animate-fade-in"
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-border/60 bg-card/40">
                    <feature.icon className="h-6 w-6 text-primary" />
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
              <span className="editorial-caps">The Process</span>
              <h2 className="font-display text-3xl md:text-4xl font-light">
                Three Simple Steps
              </h2>
            </div>

            <div className="space-y-16">
              {[
                {
                  step: '01',
                  title: 'Upload & Mark',
                  description: 'Upload your jewelry image and mark the product with simple point selections.',
                },
                {
                  step: '02',
                  title: 'Refine Mask',
                  description: 'Fine-tune the detection with intuitive brush tools. Green to add, black to remove.',
                },
                {
                  step: '03',
                  title: 'Generate',
                  description: 'Select model gender and generate. Receive both basic and enhanced results instantly.',
                },
              ].map((item, index) => (
                <div 
                  key={item.step}
                  className="flex items-start gap-8 animate-fade-in"
                  style={{ animationDelay: `${(index + 1) * 100}ms` }}
                >
                  <span className="font-display text-5xl md:text-6xl text-primary/20 font-light leading-none">
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
            <h2 className="font-display text-3xl md:text-4xl font-light">
              Ready to Transform Your Imagery?
            </h2>
            <Button 
              size="lg" 
              className="h-14 px-10 text-base font-medium tracking-wide"
              onClick={handleStart}
            >
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
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-display">FormaNova</span>
            </div>
            <p>Trustworthy AI for jewelry professionals</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
