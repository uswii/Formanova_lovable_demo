import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { ScrollRevealSection, StaggerContainer } from '@/components/ScrollRevealSection';
import { KineticText } from '@/components/KineticText';
import { CinematicHero } from '@/components/CinematicHero';

// Assets
import formanovaLogo from '@/assets/formanova-logo.png';
import heroDiamondChoker from '@/assets/jewelry/hero-diamond-choker.png';
import heroVneckNecklace from '@/assets/jewelry/hero-vneck-necklace.png';
import heroChokerBack from '@/assets/jewelry/hero-choker-back.png';
import heroHandsBracelets from '@/assets/jewelry/hero-hands-bracelets.png';
import heroHandDiamonds from '@/assets/jewelry/hero-hand-diamonds.png';
import heroGreenEarrings from '@/assets/jewelry/hero-green-earrings.png';
import heroBlueBracelets from '@/assets/jewelry/hero-blue-bracelets.png';
import heroGoldPendant from '@/assets/jewelry/hero-gold-pendant.png';
import heroModelRings from '@/assets/jewelry/hero-model-rings.png';

export default function Welcome() {
  const navigate = useNavigate();

  const heroImages = [
    { src: heroDiamondChoker, alt: 'Diamond choker necklace' },
    { src: heroVneckNecklace, alt: 'V-neck diamond necklace' },
    { src: heroChokerBack, alt: 'Diamond choker from back' },
    { src: heroHandsBracelets, alt: 'Gold bracelets on hands' },
    { src: heroHandDiamonds, alt: 'Diamond hand jewelry' },
    { src: heroGreenEarrings, alt: 'Green statement earrings' },
    { src: heroBlueBracelets, alt: 'Blue gemstone bracelets' },
    { src: heroGoldPendant, alt: 'Gold pendant necklace' },
    { src: heroModelRings, alt: 'Model with colorful rings' },
  ];

  const handleStart = () => navigate('/studio');

  const features = [
    { number: '01', title: 'Zero Alterations', description: 'Your jewelry stays exactly as uploaded. No AI hallucinations. No subtle changes.' },
    { number: '02', title: 'Verified Accuracy', description: 'See precision metrics that verify your jewelry is preserved perfectly.' },
    { number: '03', title: 'Realistic Imagery', description: 'Get stunning photoshoot imagery with lifelike models ready in seconds.' },
  ];

  const steps = [
    { number: '01', title: 'Upload', description: 'Upload your jewelry image and mark the product you want to showcase.' },
    { number: '02', title: 'Refine', description: 'AI detects your jewelry. Edit with simple brush tools if needed.' },
    { number: '03', title: 'Generate', description: 'Choose model gender, generate your photoshoot, and verify accuracy.' },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden scroll-smooth">
      {/* Hero Section with Cinematic 3D Parallax */}
      <section className="min-h-screen relative overflow-hidden bg-background">
        <CinematicHero images={heroImages} className="absolute inset-0" />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-background/90 z-10" />
        
        {/* Content */}
        <div className="relative z-20 marta-container min-h-screen flex flex-col justify-center py-24 lg:py-32">
          <ScrollRevealSection animation="fade-up" className="max-w-2xl">
            <span className="marta-label mb-8 block text-foreground/60">
              <KineticText animation="typewriter">Trustable AI Photography</KineticText>
            </span>

            <div className="mb-8">
              <KineticText as="h1" animation="split" className="marta-headline text-foreground leading-[0.85]">Your</KineticText>
              <KineticText as="h1" animation="split" delay={200} className="marta-headline text-foreground leading-[0.85]">Jewelry</KineticText>
              <KineticText as="h1" animation="split" delay={400} className="marta-headline hero-accent-text leading-[0.85]">Preserved</KineticText>
            </div>

            <ScrollRevealSection animation="fade-up" delay={300}>
              <p className="marta-body text-foreground/80 max-w-md mb-12 leading-relaxed">
                AI imagery you can trust. Your jewelry is always accurately shown. 
                No hallucinations. No subtle changes. Ever.
              </p>
            </ScrollRevealSection>

            <ScrollRevealSection animation="fade-up" delay={500}>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={handleStart} className="marta-button-filled magnetic-button">
                  <span>Start Creating</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button onClick={() => navigate('/tutorial')} className="marta-button glass-effect magnetic-button">
                  <Play className="h-4 w-4" />
                  <span>Watch Tutorial</span>
                </button>
              </div>
            </ScrollRevealSection>
          </ScrollRevealSection>
        </div>
      </section>

      {/* Features Section */}
      <section className="marta-section">
        <div className="marta-container">
          <ScrollRevealSection animation="fade-up" className="mb-16 md:mb-24">
            <span className="marta-label mb-6 block">Why FormaNova</span>
            <h2 className="marta-headline-sm">
              <KineticText animation="wave">AI You Can Actually Trust</KineticText>
            </h2>
          </ScrollRevealSection>

          <StaggerContainer className="grid md:grid-cols-3 border-t border-l border-border/20" staggerDelay={150}>
            {features.map((feature, index) => (
              <div key={index} className="marta-block border-r border-b border-border/20 relative group">
                <span className="marta-number absolute top-0 right-4 transition-all duration-500 group-hover:scale-110">
                  {feature.number}
                </span>
                <div className="relative z-10 pt-16">
                  <h3 className="font-display text-2xl md:text-3xl mb-4">{feature.title}</h3>
                  <p className="marta-body text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Process Section */}
      <section className="marta-section">
        <div className="marta-container">
          <ScrollRevealSection animation="fade-up" className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16 md:mb-24">
            <div>
              <span className="marta-label mb-6 block">Process</span>
              <h2 className="marta-headline-sm">Three Simple<br />Steps</h2>
            </div>
            <div className="hidden md:block">
              <button onClick={handleStart} className="marta-button magnetic-button">
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </ScrollRevealSection>

          <StaggerContainer className="grid lg:grid-cols-3 gap-8 lg:gap-0" staggerDelay={200}>
            {steps.map((step) => (
              <div key={step.number} className="marta-block lg:border-l-0 lg:border-r lg:border-y-0 border-border/20">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 marta-frame flex items-center justify-center bg-background">
                    <span className="font-display text-xl">{step.number}</span>
                  </div>
                </div>
                <h3 className="font-display text-3xl md:text-4xl mb-4">{step.title}</h3>
                <p className="marta-body text-muted-foreground max-w-xs">{step.description}</p>
              </div>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA Section */}
      <section className="marta-section">
        <ScrollRevealSection animation="zoom" className="marta-container text-center">
          <div className="max-w-4xl mx-auto">
            <span className="marta-label mb-12 block">Start Now</span>
            <h2 className="marta-headline mb-8">
              <KineticText animation="split">Ready To Create?</KineticText>
            </h2>
            <p className="marta-body text-muted-foreground max-w-lg mx-auto mb-12">
              Professional photoshoots with mathematically verified accuracy. Your jewelry, perfectly preserved.
            </p>
            <button onClick={handleStart} className="marta-button-filled magnetic-button">
              <span>Start Your Photoshoot</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </ScrollRevealSection>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20">
        <div className="marta-section border-b border-border/20">
          <div className="marta-container text-center">
            <span className="marta-label">Featured In</span>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-12 mb-16">
              {['CNN', 'TECHCRUNCH', 'THE TELEGRAPH', 'HUFFPOST'].map((brand) => (
                <span key={brand} className="font-display text-2xl md:text-3xl text-foreground/30">{brand}</span>
              ))}
            </div>
            <p className="font-display text-3xl md:text-4xl mb-12">
              Trusted by <span className="hero-accent-text">70+</span> Brands
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
              {['HUGO BOSS', 'ATOIR', 'TULLEEN', 'MANGO'].map((brand) => (
                <span key={brand} className="font-display text-2xl md:text-3xl text-foreground/20">{brand}</span>
              ))}
            </div>
          </div>
        </div>
        
        <div className="marta-container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <img src={formanovaLogo} alt="FormaNova" className="h-8 w-auto object-contain logo-adaptive" />
            <nav className="flex items-center gap-8">
              <Link to="/studio" className="marta-label marta-link hover:text-foreground">Studio</Link>
              <Link to="/tutorial" className="marta-label marta-link hover:text-foreground">Tutorial</Link>
              <a href="https://linkedin.com/company/rare-sense-inc" target="_blank" rel="noopener noreferrer" className="marta-label marta-link hover:text-foreground">LinkedIn</a>
            </nav>
            <p className="marta-label">© {new Date().getFullYear()} FormaNova</p>
          </div>
        </div>
      </ScrollRevealSection>
    </div>
  );
}