import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Image, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const studioTypes = [
    {
      title: 'Necklace',
      description: 'Create stunning necklace photoshoots',
      path: '/studio/necklace',
      icon: Sparkles,
    },
    {
      title: 'Earrings',
      description: 'Generate beautiful earring imagery',
      path: '/studio/earrings',
      icon: Sparkles,
    },
    {
      title: 'Bracelet',
      description: 'Design bracelet showcase photos',
      path: '/studio/bracelet',
      icon: Sparkles,
    },
    {
      title: 'Ring',
      description: 'Create elegant ring presentations',
      path: '/studio/ring',
      icon: Sparkles,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="marta-container py-12 md:py-20">
        {/* Welcome Header */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-display mb-2">
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
          </h1>
          <p className="text-muted-foreground">
            Start creating stunning jewelry photoshoots
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {studioTypes.map((studio) => (
            <Card 
              key={studio.path}
              className="group cursor-pointer hover:border-primary/50 transition-all duration-300"
              onClick={() => navigate(studio.path)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <studio.icon className="h-8 w-8 text-primary" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <CardTitle className="text-xl">{studio.title}</CardTitle>
                <CardDescription>{studio.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Secondary Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="cursor-pointer hover:border-primary/50 transition-all duration-300"
            onClick={() => navigate('/generations')}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Image className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>My Generations</CardTitle>
                  <CardDescription>View your previous creations</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="cursor-pointer hover:border-primary/50 transition-all duration-300"
            onClick={() => navigate('/credits')}
          >
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Credits & Usage</CardTitle>
                  <CardDescription>Check your available credits</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
