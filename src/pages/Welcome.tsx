import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Target, CheckCircle, Diamond, User } from 'lucide-react';
import { useScrollReveal, useMultipleScrollReveal } from '@/hooks/use-scroll-reveal';

// Assets
import formanovaLogo from '@/assets/formanova-logo.png';
import heroNecklace from '@/assets/jewelry/hero-necklace.jpg';
import resultsBanner from '@/assets/jewelry/results-banner.png';

export default function Welcome() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/studio');
  };

  // Scroll reveal hooks
  const heroReveal = useScrollReveal();
  const trustHeaderReveal = useScrollReveal();
  const { setRef: setFeatureRef, visibleItems: featureVisible } = useMultipleScrollReveal(3);
  const processHeaderReveal = useScrollReveal();
  const { setRef: setStepRef, visibleItems: stepVisible } = useMultipleScrollReveal(3);
  const ctaReveal = useScrollReveal();
  const footerReveal = useScrollReveal();

  const features = [
    {
      icon: Target,
      title: 'Zero Alterations',
      description: 'Your jewelry stays exactly as uploaded. No AI hallucinations. No subtle changes. Ever.',
    },
    {
      icon: CheckCircle,
      title: 'Mathematically Verified',
      description: 'See precision metrics that verify your jewelry is preserved perfectly in every generation.',
    },
    {
      icon: User,
      title: 'Realistic Visuals',
      description: 'Get stunning photoshoot imagery with lifelike models ready in seconds.',
    },
  ];

  const steps = [
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
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Hero Section - Editorial Split Layout */}
      <section className="relative min-h-screen flex">
        {/* Left Side - Text Content */}
        <div className="relative z-10 w-full lg:w-[55%] flex items-center px-8 md:px-12 lg:px-20 py-24 lg:py-32">
          <div 
            ref={heroReveal.ref}
            className={`max-w-xl space-y-8 transition-all duration-1000 ${
              heroReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            {/* Badge */}
            <div 
              className="inline-flex items-center gap-3 transition-all duration-700"
              style={{ transitionDelay: '200ms' }}
            >
              <div className="w-8 h-px bg-primary" />
              <span className="editorial-caps">Trustable AI photography</span>
            </div>

            {/* Headline - Editorial Typography */}
            <h1 className="editorial-headline">
              <span className="block text-5xl md:text-6xl lg:text-7xl xl:text-8xl editorial-headline-light text-foreground">
                Your Jewelry,
              </span>
              <span className="block text-5xl md:text-6xl lg:text-7xl xl:text-8xl editorial-headline-italic hero-accent-text mt-2">
                Perfectly Preserved
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground font-light leading-relaxed max-w-md">
              AI imagery you can trust. Your jewelry is always accurately shown. 
              No hallucinations. No subtle changes.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button 
                size="lg" 
                className="h-14 px-10 text-base font-medium tracking-wide"
                onClick={handleStart}
              >
                <span>Start Creating</span>
                <ArrowRight className="ml-3 h-5 w-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="lg"
                className="h-14 px-8 text-base font-medium tracking-wide editorial-link"
                onClick={() => navigate('/tutorial')}
              >
                <Play className="mr-2 h-4 w-4" />
                Watch Tutorial
              </Button>
            </div>

          </div>
        </div>

        {/* Right Side - Image */}
        <div className="hidden lg:block absolute right-0 top-0 w-[50%] h-full">
          <div className="relative h-full image-zoom">
            <img 
              src={heroNecklace} 
              alt="Elegant jewelry showcase" 
              className="w-full h-full object-cover"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/30 to-transparent" />
            
            {/* Floating accent elements */}
            <div className="absolute bottom-20 left-8 w-20 h-20 border border-primary/20" />
            <div className="absolute top-32 right-16 w-12 h-12 border border-primary/10" />
          </div>
        </div>

        {/* Mobile Background */}
        <div className="absolute inset-0 lg:hidden -z-10">
          <img 
            src={heroNecklace} 
            alt="Elegant jewelry showcase" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
        </div>
      </section>

      {/* Trust Section - Staggered Editorial Layout */}
      <section className="py-32 md:py-40 bg-secondary/20 grain-overlay">
        <div className="container px-8 md:px-12 lg:px-20">
          {/* Section Header */}
          <div 
            ref={trustHeaderReveal.ref}
            className={`max-w-3xl mb-20 md:mb-28 transition-all duration-1000 ${
              trustHeaderReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-px bg-primary" />
              <span className="editorial-caps">Why FormaNova</span>
            </div>
            <h2 className="editorial-headline text-4xl md:text-5xl lg:text-6xl editorial-headline-light">
              AI You Can
              <span className="editorial-headline-italic text-primary block">Actually Trust</span>
            </h2>
          </div>

          {/* Features - Staggered Grid */}
          <div className="grid md:grid-cols-3 gap-8 md:gap-12 lg:gap-16">
            {features.map((feature, index) => (
              <div 
                key={index}
                ref={setFeatureRef(index)}
                className={`group space-y-6 transition-all duration-700 ${
                  featureVisible[index] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'
                }`}
                style={{ 
                  transitionDelay: featureVisible[index] ? `${index * 150}ms` : '0ms',
                  marginTop: index === 1 ? '3rem' : index === 2 ? '6rem' : '0'
                }}
              >
                {/* Step number as background */}
                <span className="step-number-huge text-7xl md:text-8xl text-primary/5">
                  0{index + 1}
                </span>
                
                <div className="space-y-4 -mt-10">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-500">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  
                  <h3 className="font-editorial text-2xl md:text-3xl font-medium">{feature.title}</h3>
                  
                  <p className="text-muted-foreground text-base leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Editorial Timeline */}
      <section className="py-32 md:py-40">
        <div className="container px-8 md:px-12 lg:px-20">
          {/* Section Header */}
          <div 
            ref={processHeaderReveal.ref}
            className={`flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-20 md:mb-28 transition-all duration-1000 ${
              processHeaderReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div className="max-w-xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-px bg-primary" />
                <span className="editorial-caps">Process</span>
              </div>
              <h2 className="editorial-headline text-4xl md:text-5xl lg:text-6xl editorial-headline-light">
                Three Simple
                <span className="editorial-headline-italic text-primary block">Steps</span>
              </h2>
            </div>
            
            <div className="hidden md:block">
              <Button 
                size="lg"
                className="h-12 px-8"
                onClick={handleStart}
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Steps - Horizontal Layout on Desktop */}
          <div className="relative">
            {/* Connecting line */}
            <div className="hidden lg:block absolute top-24 left-0 right-0 h-px bg-border" />
            
            <div className="grid lg:grid-cols-3 gap-12 lg:gap-8">
              {steps.map((item, index) => (
                <div 
                  key={item.step}
                  ref={setStepRef(index)}
                  className={`relative transition-all duration-700 ${
                    stepVisible[index] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'
                  }`}
                  style={{ transitionDelay: stepVisible[index] ? `${index * 200}ms` : '0ms' }}
                >
                  {/* Large step number */}
                  <span className="step-number-huge text-8xl md:text-9xl lg:text-[10rem] text-primary/5 absolute -top-8 -left-4 lg:-top-12 lg:-left-8 select-none">
                    {item.step}
                  </span>
                  
                  {/* Dot on timeline */}
                  <div className="hidden lg:flex absolute top-24 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background border-2 border-primary z-10" />
                  
                  <div className="relative pt-12 lg:pt-36 space-y-4">
                    <h3 className="font-editorial text-2xl md:text-3xl font-medium">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-base leading-relaxed max-w-xs">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile CTA */}
          <div className="md:hidden mt-12 text-center">
            <Button 
              size="lg"
              className="h-14 px-10"
              onClick={handleStart}
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
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

      {/* Final CTA - Full Width Editorial */}
      <section className="py-32 md:py-40">
        <div 
          ref={ctaReveal.ref}
          className={`container px-8 md:px-12 lg:px-20 transition-all duration-1000 ${
            ctaReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          <div className="max-w-4xl mx-auto text-center space-y-10">
            {/* Decorative diamonds */}
            <div className="flex items-center justify-center gap-4">
              <Diamond className="h-5 w-5 text-primary/40" />
              <Diamond className="h-3 w-3 text-primary/20" />
              <Diamond className="h-5 w-5 text-primary/40" />
            </div>
            
            <h2 className="editorial-headline text-5xl md:text-6xl lg:text-7xl editorial-headline-light">
              Ready to
              <span className="editorial-headline-italic text-primary block">Create?</span>
            </h2>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto">
              Professional photoshoots with mathematically verified accuracy.
            </p>
            
            <Button 
              size="lg" 
              className="h-16 px-12 text-lg font-medium tracking-wide"
              onClick={handleStart}
            >
              <span>Start Your Photoshoot</span>
              <ArrowRight className="ml-3 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer - Editorial Style */}
      <footer 
        ref={footerReveal.ref}
        className={`bg-card border-t border-border transition-all duration-1000 ${
          footerReveal.isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Featured In */}
        <div className="px-8 md:px-12 lg:px-20 py-20 text-center">
          <span className="editorial-caps">Featured in</span>
          
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-12 mb-16">
            <span className="text-2xl md:text-3xl font-bold tracking-tight text-foreground/50">CNN</span>
            <span className="text-xl md:text-2xl font-semibold text-foreground/50">TechCrunch</span>
            <span className="text-lg md:text-xl font-medium uppercase tracking-wider text-foreground/50">The Telegraph</span>
            <span className="text-xl md:text-2xl font-bold text-foreground/50">HuffPost</span>
          </div>
          
          <div className="editorial-hr mb-16" />
          
          <p className="font-editorial text-2xl md:text-3xl mb-12">
            Trusted by <span className="text-primary font-semibold">70+</span> brands
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            <span className="text-xl md:text-2xl font-bold tracking-wider text-foreground/40">HUGO BOSS</span>
            <span className="text-xl md:text-2xl font-light tracking-widest text-foreground/40">ATOIR</span>
            <span className="text-xl md:text-2xl italic font-light text-foreground/40">Tulleen</span>
            <span className="text-xl md:text-2xl font-bold tracking-wide text-foreground/40">MANGO</span>
          </div>
        </div>
        
        {/* Bottom */}
        <div className="border-t border-border/50 px-8 md:px-12 lg:px-20 py-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <img 
              src={formanovaLogo} 
              alt="FormaNova" 
              className="h-8 w-auto object-contain logo-adaptive"
            />
            
            <nav className="flex items-center gap-8">
              <Link to="/studio" className="text-sm text-muted-foreground hover:text-foreground transition-colors editorial-link">
                Studio
              </Link>
              <Link to="/tutorial" className="text-sm text-muted-foreground hover:text-foreground transition-colors editorial-link">
                Tutorial
              </Link>
              <a 
                href="https://linkedin.com/company/rare-sense-inc" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors editorial-link"
              >
                LinkedIn
              </a>
            </nav>
            
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} FormaNova
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
