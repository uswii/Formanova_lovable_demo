import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, PlayCircle, BookOpen, CheckCircle2 } from 'lucide-react';
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
      step: 1,
      title: 'Upload & Mark',
      description: 'Upload your jewelry image and mark the jewelry with red dots to identify it.',
    },
    {
      step: 2,
      title: 'Refine Mask',
      description: 'Use green brush to add areas and black brush to remove areas from the mask.',
    },
    {
      step: 3,
      title: 'Generate',
      description: 'Choose gender and generate stunning professional photoshoots.',
    },
  ];

  return (
    <div className="min-h-screen formanova-gradient py-12">
      <div className="container px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <h1 className="font-display text-4xl font-bold">Tutorial</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Learn how to create stunning jewelry photoshoots in minutes
          </p>
        </div>

        {/* Video Embed */}
        <Card className="mb-12 overflow-hidden animate-scale-in">
          <CardContent className="p-0">
            <div className="aspect-video bg-muted">
              <iframe
                src="https://www.youtube.com/embed/0iS8ypFCSU0"
                title="FormaNova Tutorial"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Steps */}
        <div className="mb-12">
          <h2 className="font-display text-2xl font-semibold text-center mb-8">
            Quick Overview
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((item, index) => (
              <Card 
                key={item.step} 
                className="bg-card/50 backdrop-blur animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                      {item.step}
                    </div>
                    <CardTitle className="font-display text-lg">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Key Features */}
        <Card className="mb-12 bg-card/50 backdrop-blur animate-fade-in">
          <CardHeader>
            <CardTitle className="font-display text-xl">Key Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                'Non-composite mode ensures your jewelry is never modified',
                'BiRefNet automatic background removal',
                'SAM-powered intelligent masking',
                'Green/Black brush for precise mask editing',
                'Dual output: Basic (Flux) and Enhanced (Gemini)',
                'Fidelity visualization with precision metrics',
                'Before/After comparison slider',
              ].map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center animate-fade-in-up">
          <p className="text-muted-foreground mb-4">
            You can always access the tutorial later from the app
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8"
            onClick={handleStart}
          >
            <PlayCircle className="h-5 w-5 mr-2" />
            Start Using FormaNova
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
