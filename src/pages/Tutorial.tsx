import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play } from 'lucide-react';
import { useScrollReveal, useMultipleScrollReveal } from '@/hooks/use-scroll-reveal';

export default function Tutorial() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/studio');
  };

  // Scroll reveal hooks
  const headerReveal = useScrollReveal();
  const videoReveal = useScrollReveal();
  const { setRef: setStepRef, visibleItems: stepVisible } = useMultipleScrollReveal(3);
  const ctaReveal = useScrollReveal();

  const steps = [
    {
      step: '01',
      title: 'Upload',
      description: 'Upload your jewelry image.',
    },
    {
      step: '02',
      title: 'Modify Mask (Optional)',
      description: 'Refine the selection if needed.',
    },
    {
      step: '03',
      title: 'Generate',
      description: 'Get your photoshoot.',
    },
  ];

  return (
    <div className="min-h-screen formanova-gradient grain-overlay">
      <div className="container px-8 md:px-12 lg:px-20 py-16 max-w-5xl relative z-10">
        {/* Back link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors mb-16 editorial-link"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>

        {/* Header */}
        <div 
          ref={headerReveal.ref}
          className={`mb-20 space-y-6 transition-all duration-1000 ${
            headerReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-px bg-primary" />
            <span className="editorial-caps">Getting Started</span>
          </div>
          
          <h1 className="editorial-headline text-4xl md:text-5xl lg:text-6xl editorial-headline-light">
            Three Simple
            <span className="editorial-headline-italic text-primary block">Steps</span>
          </h1>
          
          <p className="text-muted-foreground text-lg max-w-xl">
            Transform your jewelry photos into professional model imagery
          </p>
        </div>

        {/* Video Embed */}
        <div 
          ref={videoReveal.ref}
          className={`mb-24 transition-all duration-1000 ${
            videoReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          <div className="aspect-video rounded-lg overflow-hidden border border-border/60 bg-card/40 editorial-shadow">
            <iframe
              src="https://www.youtube.com/embed/0iS8ypFCSU0"
              title="FormaNova Tutorial"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Quick Steps - Editorial Layout */}
        <div className="mb-24">
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((item, index) => (
              <div 
                key={item.step}
                ref={setStepRef(index)}
                className={`relative text-center md:text-left space-y-4 transition-all duration-700 ${
                  stepVisible[index] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'
                }`}
                style={{ transitionDelay: stepVisible[index] ? `${index * 150}ms` : '0ms' }}
              >
                {/* Large background number */}
                <span className="step-number-huge text-7xl md:text-8xl text-primary/5 block">
                  {item.step}
                </span>
                
                <div className="-mt-8 space-y-2">
                  <h3 className="font-editorial text-xl md:text-2xl font-medium">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* CTA */}
        <div 
          ref={ctaReveal.ref}
          className={`text-center space-y-6 transition-all duration-1000 ${
            ctaReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
          }`}
        >
          <Button 
            size="lg" 
            className="h-14 px-12 font-medium tracking-wide"
            onClick={handleStart}
          >
            <Play className="h-4 w-4 mr-3" />
            <span>Start Creating</span>
          </Button>
          <p className="text-xs text-muted-foreground">
            Access this guide anytime from the menu.
          </p>
        </div>
      </div>
    </div>
  );
}
