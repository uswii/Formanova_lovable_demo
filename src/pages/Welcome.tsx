import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Target, CheckCircle, Diamond } from 'lucide-react';
import modelSilhouette from '@/assets/icons/model-silhouette.png';

// Assets
import formanovaLogo from '@/assets/formanova-logo.png';
import heroNecklace from '@/assets/jewelry/hero-necklace.jpg';
import necklaceGold from '@/assets/jewelry/necklace-gold.jpg';
import necklacePearl from '@/assets/jewelry/necklace-pearl.jpg';
import necklaceDiamond from '@/assets/jewelry/necklace-diamond.jpg';
import resultsBanner from '@/assets/jewelry/results-banner.png';

export default function Welcome() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/studio');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src={heroNecklace} 
            alt="Elegant jewelry showcase" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 container px-8 py-20">
          <div className="max-w-2xl space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/30 bg-black/50 backdrop-blur-sm">
              <Diamond className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium tracking-wide text-white">Trustable AI Photography</span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-light leading-tight text-white">
              Your Jewelry,
              <span className="block hero-accent-text italic">Perfectly Preserved</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-white/80 font-light leading-relaxed max-w-xl">
              AI imagery you can trust. Your jewelry is always accurately shown. No hallucinations. No subtle changes.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg font-medium formanova-glow"
                onClick={handleStart}
              >
                Start Creating
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              
              <Button 
                variant="outline" 
                size="lg"
                className="h-14 px-8 text-lg font-medium"
                onClick={() => navigate('/tutorial')}
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Tutorial
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 bg-secondary/30">
        <div className="container px-8">
          <div className="max-w-4xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-16">
              <p className="text-primary font-medium tracking-widest uppercase text-sm mb-4">Why FormaNova</p>
              <h2 className="font-display text-4xl md:text-5xl font-light">
                AI You Can Actually Trust
              </h2>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display text-2xl">Zero Alterations</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Your jewelry stays exactly as uploaded. No AI hallucinations. No subtle changes. Ever.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display text-2xl">Mathematically Verified</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  See precision metrics that verify your jewelry is preserved perfectly in every generation.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16">
                  <img src={modelSilhouette} alt="Model silhouette" className="w-full h-full object-contain" />
                </div>
                <h3 className="font-display text-2xl">Realistic Visuals</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Get stunning photoshoot imagery with lifelike models ready in seconds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* How It Works */}
      <section className="py-24 bg-secondary/30">
        <div className="container px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-primary font-medium tracking-widest uppercase text-sm mb-4">Process</p>
              <h2 className="font-display text-4xl md:text-5xl font-light">
                Three Simple Steps
              </h2>
            </div>

            <div className="space-y-12">
              {[
                {
                  step: '01',
                  title: 'Upload Your Photo',
                  description: 'Upload your jewelry image and mark the product you want to showcase.',
                },
                {
                  step: '02',
                  title: 'Refine the Mask',
                  description: 'AI detects your jewelry. Edit with simple brush tools if needed.',
                },
                {
                  step: '03',
                  title: 'Generate & Verify',
                  description: 'Choose model gender, generate your photoshoot, and see the accuracy metrics.',
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-8">
                  <span className="font-display text-6xl md:text-7xl text-primary/20 font-light leading-none">
                    {item.step}
                  </span>
                  <div className="pt-3 space-y-2">
                    <h3 className="font-display text-2xl md:text-3xl">{item.title}</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Results Banner */}
      <section className="w-full">
        <img 
          src={resultsBanner} 
          alt="FormaNova AI jewelry photography results" 
          className="w-full h-auto"
        />
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="container px-8 text-center">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex items-center justify-center gap-3">
              <Diamond className="h-6 w-6 text-primary" />
              <Diamond className="h-4 w-4 text-primary/60" />
              <Diamond className="h-6 w-6 text-primary" />
            </div>
            
            <h2 className="font-display text-4xl md:text-5xl font-light">
              Ready to Create?
            </h2>
            
            <p className="text-xl text-muted-foreground">
              Professional photoshoots with mathematically verified accuracy.
            </p>
            
            <Button 
              size="lg" 
              className="h-14 px-10 text-lg font-medium formanova-glow"
              onClick={handleStart}
            >
              Start Your Photoshoot
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border">
        {/* Featured In */}
        <div className="px-8 py-16 text-center">
          <p className="text-sm text-muted-foreground mb-10 uppercase tracking-widest">Featured In</p>
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16 mb-12">
            <span className="text-2xl md:text-3xl font-bold text-foreground/60">CNN</span>
            <span className="text-xl md:text-2xl font-semibold text-foreground/60">TechCrunch</span>
            <span className="text-lg md:text-xl font-medium text-foreground/60 uppercase tracking-wider">The Telegraph</span>
            <span className="text-xl md:text-2xl font-bold text-foreground/60">HuffPost</span>
          </div>
          
          <div className="w-32 h-px bg-border mx-auto mb-12" />
          
          <p className="font-display text-2xl mb-10">
            Trusted By <span className="text-primary font-semibold">70+</span> Brands
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-12 md:gap-16">
            <span className="text-xl md:text-2xl font-bold tracking-wider text-foreground/50">HUGO BOSS</span>
            <span className="text-xl md:text-2xl font-light tracking-widest text-foreground/50">ATOIR</span>
            <span className="text-xl md:text-2xl italic font-light text-foreground/50">Tulleen</span>
            <span className="text-xl md:text-2xl font-bold tracking-wide text-foreground/50">MANGO</span>
          </div>
        </div>
        
        {/* Bottom */}
        <div className="border-t border-border/50 px-8 py-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <img 
              src={formanovaLogo} 
              alt="FormaNova" 
              className="h-8 w-auto object-contain logo-adaptive"
            />
            
            <div className="flex items-center gap-8">
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
            
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} FormaNova
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
