import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Play, Shield, Sparkles, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Tutorial() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleStart = () => {
    if (user) {
      navigate('/studio');
    } else {
      navigate('/auth');
    }
  };

  const steps = [
    {
      step: '01',
      title: 'Upload Your Piece',
      description: 'Drop in any jewelry photo — we handle the rest.',
    },
    {
      step: '02',
      title: 'Quick Touch-Up',
      description: 'Fine-tune the selection if needed. Most images work automatically.',
    },
    {
      step: '03',
      title: 'Get Your Photoshoot',
      description: 'Choose your model and receive professional imagery in seconds.',
    },
  ];

  const benefits = [
    {
      icon: Shield,
      title: 'Your Jewelry, Untouched',
      description: 'Every gemstone, every detail preserved exactly as photographed.',
    },
    {
      icon: Sparkles,
      title: 'Studio-Quality Results',
      description: 'Professional model imagery that elevates your brand.',
    },
    {
      icon: Clock,
      title: 'Ready in Seconds',
      description: 'Skip the expensive photoshoots. Get results instantly.',
    },
  ];

  return (
    <div className="min-h-screen formanova-gradient py-16">
      <div className="container px-6 max-w-4xl">
        {/* Back link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Header */}
        <div className="text-center mb-16 space-y-4 animate-fade-in">
          <span className="editorial-caps">Getting Started</span>
          <h1 className="font-display text-4xl md:text-5xl font-light">
            Three Simple Steps
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Transform your jewelry photos into professional model imagery
          </p>
        </div>

        {/* Video Embed */}
        <div className="mb-20 animate-fade-in animation-delay-100">
          <div className="aspect-video rounded-lg overflow-hidden border border-border/60 bg-card/40 shadow-lg">
            <iframe
              src="https://www.youtube.com/embed/0iS8ypFCSU0"
              title="FormaNova Tutorial"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Quick Steps */}
        <div className="mb-20">
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item, index) => (
              <div 
                key={item.step}
                className="text-center space-y-4 animate-fade-in"
                style={{ animationDelay: `${(index + 2) * 100}ms` }}
              >
                <span className="inline-block font-display text-5xl text-primary/20 font-light">
                  {item.step}
                </span>
                <h3 className="font-display text-xl">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-20 animate-fade-in animation-delay-500">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl font-light">
              Why FormaNova
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div 
                key={index} 
                className="bg-card/40 backdrop-blur-sm border border-border/60 rounded-lg p-6 text-center space-y-3"
              >
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary">
                  <benefit.icon className="h-5 w-5" />
                </div>
                <h4 className="font-display text-lg">{benefit.title}</h4>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 animate-fade-in animation-delay-700">
          <Button 
            size="lg" 
            className="h-14 px-10 font-medium tracking-wide"
            onClick={handleStart}
          >
            <Play className="h-4 w-4 mr-2" />
            Start Creating
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Access this guide anytime from the menu
          </p>
        </div>
      </div>
    </div>
  );
}
