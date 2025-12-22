import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { useScrollReveal, useMultipleScrollReveal } from '@/hooks/use-scroll-reveal';

// Assets
import formanovaLogo from '@/assets/formanova-logo.png';
import heroNecklace from '@/assets/jewelry/hero-necklace.jpg';
import jewelryHandsGold from '@/assets/jewelry/jewelry-hands-gold.png';
import jewelryModelShadow from '@/assets/jewelry/jewelry-model-shadow.png';
import jewelryRingsBlue from '@/assets/jewelry/jewelry-rings-blue.png';
import jewelryEarringGreen from '@/assets/jewelry/jewelry-earring-green.png';
import jewelryNecklaceDiamonds from '@/assets/jewelry/jewelry-necklace-diamonds.png';

export default function Welcome() {
  const navigate = useNavigate();
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setImagesLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    navigate('/studio');
  };

  // Scroll reveal hooks
  const heroReveal = useScrollReveal();
  const featuresReveal = useScrollReveal();
  const { setRef: setFeatureRef, visibleItems: featureVisible } = useMultipleScrollReveal(3);
  const processReveal = useScrollReveal();
  const { setRef: setStepRef, visibleItems: stepVisible } = useMultipleScrollReveal(3);
  const ctaReveal = useScrollReveal();
  const footerReveal = useScrollReveal();

  // Hero images for Marta-style grid
  const heroImages = [
    { src: jewelryHandsGold, alt: 'Gold jewelry on hands', delay: 0 },
    { src: jewelryModelShadow, alt: 'Model with jewelry', delay: 100 },
    { src: jewelryRingsBlue, alt: 'Blue gemstone rings', delay: 200 },
    { src: jewelryEarringGreen, alt: 'Green earring', delay: 300 },
    { src: jewelryNecklaceDiamonds, alt: 'Diamond necklace', delay: 400 },
  ];

  const features = [
    {
      number: '01',
      title: 'Zero Alterations',
      description: 'Your jewelry stays exactly as uploaded. No AI hallucinations. No subtle changes.',
    },
    {
      number: '02',
      title: 'Verified Accuracy',
      description: 'See precision metrics that verify your jewelry is preserved perfectly.',
    },
    {
      number: '03',
      title: 'Realistic Imagery',
      description: 'Get stunning photoshoot imagery with lifelike models ready in seconds.',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Upload',
      description: 'Upload your jewelry image and mark the product you want to showcase.',
    },
    {
      number: '02',
      title: 'Refine',
      description: 'AI detects your jewelry. Edit with simple brush tools if needed.',
    },
    {
      number: '03',
      title: 'Generate',
      description: 'Choose model gender, generate your photoshoot, and verify accuracy.',
    },
  ];


  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Hero Section - Clean Marta Verba Style */}
      <section className="min-h-screen relative bg-background">
        <div className="marta-container min-h-screen grid lg:grid-cols-2 gap-8 lg:gap-16">
          
          {/* Left: Text Content */}
          <div 
            ref={heroReveal.ref}
            className={`flex flex-col justify-center py-24 lg:py-32 transition-all duration-1000 ${
              heroReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            {/* Label */}
            <span className="marta-label mb-8 block text-muted-foreground">Trustable AI Photography</span>

            {/* Giant Headline - Stacked */}
            <div className="mb-8">
              <h1 className="marta-headline text-foreground leading-[0.85]">Your</h1>
              <h1 className="marta-headline text-foreground leading-[0.85]">Jewelry</h1>
              <h1 className="marta-headline hero-accent-text leading-[0.85]">Preserved</h1>
            </div>

            {/* Subtext */}
            <p className="marta-body text-muted-foreground max-w-md mb-12 leading-relaxed">
              AI imagery you can trust. Your jewelry is always accurately shown. 
              No hallucinations. No subtle changes. Ever.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleStart}
                className="marta-button-filled"
              >
                <span>Start Creating</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              
              <button 
                onClick={() => navigate('/tutorial')}
                className="marta-button"
              >
                <Play className="h-4 w-4" />
                <span>Watch Tutorial</span>
              </button>
            </div>
          </div>

          {/* Right: Image Grid - Marta Style Asymmetric */}
          <div className="relative flex items-center py-12 lg:py-24">
            <div className="w-full grid grid-cols-6 grid-rows-6 gap-2 aspect-square max-h-[80vh]">
              {/* Main large image - spans 4 cols, 4 rows */}
              <div 
                className={`col-span-4 row-span-4 marta-frame overflow-hidden transition-all duration-700 ${
                  imagesLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                style={{ transitionDelay: '100ms' }}
              >
                <img 
                  src={heroImages[0].src} 
                  alt={heroImages[0].alt} 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
              
              {/* Top right - 2 cols, 2 rows */}
              <div 
                className={`col-span-2 row-span-2 marta-frame overflow-hidden transition-all duration-700 ${
                  imagesLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                style={{ transitionDelay: '200ms' }}
              >
                <img 
                  src={heroImages[1].src} 
                  alt={heroImages[1].alt} 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
              
              {/* Middle right - 2 cols, 2 rows */}
              <div 
                className={`col-span-2 row-span-2 marta-frame overflow-hidden transition-all duration-700 ${
                  imagesLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                style={{ transitionDelay: '300ms' }}
              >
                <img 
                  src={heroImages[2].src} 
                  alt={heroImages[2].alt} 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
              
              {/* Bottom left - 3 cols, 2 rows */}
              <div 
                className={`col-span-3 row-span-2 marta-frame overflow-hidden transition-all duration-700 ${
                  imagesLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                style={{ transitionDelay: '400ms' }}
              >
                <img 
                  src={heroImages[3].src} 
                  alt={heroImages[3].alt} 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
              
              {/* Bottom right - 3 cols, 2 rows */}
              <div 
                className={`col-span-3 row-span-2 marta-frame overflow-hidden transition-all duration-700 ${
                  imagesLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                style={{ transitionDelay: '500ms' }}
              >
                <img 
                  src={heroImages[4].src} 
                  alt={heroImages[4].alt} 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Modular Grid */}
      <section className="marta-section">
        <div className="marta-container">
          {/* Section Header */}
          <div 
            ref={featuresReveal.ref}
            className={`mb-16 md:mb-24 transition-all duration-1000 ${
              featuresReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <span className="marta-label mb-6 block">Why FormaNova</span>
            <h2 className="marta-headline-sm">
              AI You Can<br />Actually Trust
            </h2>
          </div>

          {/* Features Grid with Borders */}
          <div className="grid md:grid-cols-3 border-t border-l border-border/20">
            {features.map((feature, index) => (
              <div 
                key={index}
                ref={setFeatureRef(index)}
                className={`marta-block border-r border-b border-border/20 relative transition-all duration-700 ${
                  featureVisible[index] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'
                }`}
                style={{ transitionDelay: featureVisible[index] ? `${index * 150}ms` : '0ms' }}
              >
                {/* Large number background */}
                <span className="marta-number absolute top-0 right-4">
                  {feature.number}
                </span>
                
                <div className="relative z-10 pt-16">
                  <h3 className="font-display text-2xl md:text-3xl mb-4">{feature.title}</h3>
                  <p className="marta-body text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Process Section - Horizontal Steps */}
      <section className="marta-section">
        <div className="marta-container">
          {/* Section Header */}
          <div 
            ref={processReveal.ref}
            className={`flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16 md:mb-24 transition-all duration-1000 ${
              processReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
          >
            <div>
              <span className="marta-label mb-6 block">Process</span>
              <h2 className="marta-headline-sm">
                Three Simple<br />Steps
              </h2>
            </div>
            
            <div className="hidden md:block">
              <button onClick={handleStart} className="marta-button">
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Steps - Horizontal */}
          <div className="relative">
            
            <div className="grid lg:grid-cols-3 gap-8 lg:gap-0">
              {steps.map((step, index) => (
                <div 
                  key={step.number}
                  ref={setStepRef(index)}
                  className={`relative transition-all duration-700 ${
                    stepVisible[index] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'
                  }`}
                  style={{ transitionDelay: stepVisible[index] ? `${index * 200}ms` : '0ms' }}
                >
                  <div className="marta-block lg:border-l-0 lg:border-r lg:border-y-0 border-border/20 relative">
                    {/* Step number */}
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 marta-frame flex items-center justify-center bg-background relative z-10">
                        <span className="font-display text-xl">{step.number}</span>
                      </div>
                    </div>
                    
                    <h3 className="font-display text-3xl md:text-4xl mb-4">{step.title}</h3>
                    <p className="marta-body text-muted-foreground max-w-xs">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile CTA */}
          <div className="md:hidden mt-12 text-center">
            <button onClick={handleStart} className="marta-button-filled">
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>


      {/* Final CTA Section */}
      <section className="marta-section">
        <div 
          ref={ctaReveal.ref}
          className={`marta-container text-center transition-all duration-1000 ${
            ctaReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          <div className="max-w-4xl mx-auto">
            <span className="marta-label mb-12 block">Start Now</span>
            
            <h2 className="marta-headline mb-8">
              Ready To<br />Create?
            </h2>
            
            <p className="marta-body text-muted-foreground max-w-lg mx-auto mb-12">
              Professional photoshoots with mathematically verified accuracy. 
              Your jewelry, perfectly preserved.
            </p>
            
            <button onClick={handleStart} className="marta-button-filled">
              <span>Start Your Photoshoot</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer - Editorial Grid */}
      <footer 
        ref={footerReveal.ref}
        className={`border-t border-border/20 transition-all duration-1000 ${
          footerReveal.isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Featured In / Trusted By */}
        <div className="marta-section border-b border-border/20">
          <div className="marta-container text-center">
            <span className="marta-label">Featured In</span>
            
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-12 mb-16">
              <span className="font-display text-3xl md:text-4xl text-foreground/30">CNN</span>
              <span className="font-display text-2xl md:text-3xl text-foreground/30">TECHCRUNCH</span>
              <span className="font-display text-xl md:text-2xl text-foreground/30">THE TELEGRAPH</span>
              <span className="font-display text-2xl md:text-3xl text-foreground/30">HUFFPOST</span>
            </div>
            
            <div className="mb-16" />
            
            <p className="font-display text-3xl md:text-4xl mb-12">
              Trusted by <span className="hero-accent-text">70+</span> Brands
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
              <span className="font-display text-2xl md:text-3xl tracking-wider text-foreground/20">HUGO BOSS</span>
              <span className="font-display text-2xl md:text-3xl tracking-widest text-foreground/20">ATOIR</span>
              <span className="font-display text-2xl md:text-3xl text-foreground/20">TULLEEN</span>
              <span className="font-display text-2xl md:text-3xl tracking-wide text-foreground/20">MANGO</span>
            </div>
          </div>
        </div>
        
        {/* Bottom Footer */}
        <div className="marta-container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <img 
              src={formanovaLogo} 
              alt="FormaNova" 
              className="h-8 w-auto object-contain logo-adaptive"
            />
            
            <nav className="flex items-center gap-8">
              <Link to="/studio" className="marta-label marta-link hover:text-foreground">
                Studio
              </Link>
              <Link to="/tutorial" className="marta-label marta-link hover:text-foreground">
                Tutorial
              </Link>
              <a 
                href="https://linkedin.com/company/rare-sense-inc" 
                target="_blank" 
                rel="noopener noreferrer"
                className="marta-label marta-link hover:text-foreground"
              >
                LinkedIn
              </a>
            </nav>
            
            <p className="marta-label">
              © {new Date().getFullYear()} FormaNova
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
