import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Play, Check } from 'lucide-react';
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
      title: 'Upload & Mark',
      description: 'Upload your jewelry image and mark the product with point selections to identify it.',
    },
    {
      step: '02',
      title: 'Refine Mask',
      description: 'Use green brush to add areas and black brush to remove areas from the detection mask.',
    },
    {
      step: '03',
      title: 'Generate',
      description: 'Choose model gender and generate professional photoshoots with your preserved jewelry.',
    },
  ];

  const features = [
    'Non-composite mode ensures pixel-perfect preservation',
    'BiRefNet automatic background removal',
    'SAM-powered intelligent masking',
    'Green/black brush for precise mask editing',
    'Dual output: Basic (Flux) and Enhanced (Gemini)',
    'Fidelity visualization with precision metrics',
    'Before/after comparison slider',
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
            How It Works
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Learn how to create stunning jewelry photoshoots in minutes
          </p>
        </div>

        {/* Video Embed */}
        <div className="mb-20 animate-fade-in animation-delay-100">
          <div className="aspect-video rounded-lg overflow-hidden border border-border/60 bg-card/40">
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
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl font-light">
              The Process
            </h2>
          </div>
          
          <div className="space-y-12">
            {steps.map((item, index) => (
              <div 
                key={item.step}
                className="flex items-start gap-8 animate-fade-in"
                style={{ animationDelay: `${(index + 2) * 100}ms` }}
              >
                <span className="font-display text-4xl md:text-5xl text-primary/20 font-light leading-none shrink-0">
                  {item.step}
                </span>
                <div className="pt-1 space-y-2">
                  <h3 className="font-display text-xl md:text-2xl">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Features */}
        <div className="mb-20 animate-fade-in animation-delay-500">
          <div className="text-center mb-12">
            <h2 className="font-display text-2xl md:text-3xl font-light">
              Key Features
            </h2>
          </div>
          
          <div className="bg-card/40 backdrop-blur-sm border border-border/60 rounded-lg p-8">
            <ul className="space-y-4">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-4">
                  <div className="mt-1 h-5 w-5 rounded-full border border-primary/30 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4 animate-fade-in animation-delay-700">
          <p className="text-sm text-muted-foreground">
            You can access this tutorial anytime from the main navigation
          </p>
          <Button 
            size="lg" 
            className="h-14 px-10 font-medium tracking-wide"
            onClick={handleStart}
          >
            <Play className="h-4 w-4 mr-2" />
            Start Creating
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
