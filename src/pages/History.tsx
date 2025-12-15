import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History as HistoryIcon, Loader2, Sparkles, Clock, Download } from 'lucide-react';

export default function History() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // TODO: Fetch generation history from database
  const generations: any[] = [];

  return (
    <div className="min-h-screen formanova-gradient py-12">
      <div className="container px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <HistoryIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-display text-3xl font-bold">Generation History</h1>
              <p className="text-muted-foreground">View and download your past photoshoots</p>
            </div>
          </div>
          <Button asChild>
            <Link to="/studio">
              <Sparkles className="h-4 w-4 mr-2" />
              New Photoshoot
            </Link>
          </Button>
        </div>

        {generations.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="py-16 text-center">
              <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">No generations yet</h3>
              <p className="text-muted-foreground mb-6">
                Your photoshoot history will appear here once you start creating.
              </p>
              <Button asChild>
                <Link to="/studio">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Your First Photoshoot
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {generations.map((gen, index) => (
              <Card key={index} className="bg-card/50 backdrop-blur overflow-hidden group hover:border-primary/50 transition-all">
                <div className="aspect-[3/4] relative overflow-hidden">
                  <img 
                    src={gen.thumbnail} 
                    alt={`Generation ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <Button size="sm" variant="secondary" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    {new Date(gen.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
