import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, PlayCircle, ArrowRight, Shield, Gem, Wand2 } from 'lucide-react';
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
    <div className="min-h-screen formanova-gradient">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container px-4 py-20 md:py-32">
          <div className="flex flex-col items-center text-center space-y-8 animate-fade-in">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Sparkles className="h-12 w-12 text-primary animate-float" />
                <div className="absolute inset-0 h-12 w-12 bg-primary/20 blur-xl rounded-full" />
              </div>
              <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">
                FormaNova
              </h1>
            </div>

            {/* Tagline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
              Transform your jewelry images into stunning professional photoshoots using AI
            </p>

            {/* Trust Message */}
            <Card className="border-primary/20 bg-card/50 backdrop-blur max-w-xl">
              <CardContent className="flex items-center gap-4 p-6">
                <Shield className="h-10 w-10 text-primary shrink-0" />
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Trustworthy AI</h3>
                  <p className="text-muted-foreground text-sm">
                    We never change your jewelry — your actual product stays exactly the same as uploaded. 
                    Pixel-perfect preservation guaranteed.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* First Time Box */}
            <Card className="border-accent bg-card/80 backdrop-blur w-full max-w-md animate-scale-in animation-delay-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <PlayCircle className="h-5 w-5" />
                  <span className="font-medium">🎥 First time here?</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Watch our quick tutorial to learn how to create stunning jewelry photoshoots in minutes.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => navigate('/tutorial')}
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Yes, Show Tutorial
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleStart}
                  >
                    Skip to App
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container px-4">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12">
            Why Choose FormaNova?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="bg-card/50 backdrop-blur border-border/50 animate-fade-in-up">
              <CardContent className="p-6 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold">Non-Composite Mode</h3>
                <p className="text-muted-foreground text-sm">
                  Your jewelry pixels are strictly preserved with hard binary mask paste — 
                  no AI modifications to your product.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50 animate-fade-in-up animation-delay-100">
              <CardContent className="p-6 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Gem className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold">Precision Metrics</h3>
                <p className="text-muted-foreground text-sm">
                  Full fidelity visualization with precision, recall, and IoU metrics 
                  to verify your jewelry is perfectly preserved.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50 animate-fade-in-up animation-delay-200">
              <CardContent className="p-6 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Wand2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold">Dual Output</h3>
                <p className="text-muted-foreground text-sm">
                  Get both Basic (Flux) and Enhanced (Gemini-refined) results 
                  for every generation.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container px-4 text-center">
          <Button 
            size="lg" 
            className="text-lg px-8 py-6 formanova-glow animate-glow-pulse"
            onClick={handleStart}
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Start Creating
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );
}
