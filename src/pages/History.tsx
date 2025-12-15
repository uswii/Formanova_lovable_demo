import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History as HistoryIcon, Loader2, Sparkles, Clock, Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Generation {
  id: string;
  original_image: string;
  generated_image: string;
  created_at: string;
}

export default function History() {
  const { user, loading } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchGenerations();
    }
  }, [user]);

  const fetchGenerations = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('generations')
      .select('id, original_image, generated_image, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching generations:', error);
      toast({ variant: 'destructive', title: 'Failed to load history' });
    } else {
      setGenerations(data || []);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('generations').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to delete' });
    } else {
      setGenerations((prev) => prev.filter((g) => g.id !== id));
      toast({ title: 'Deleted successfully' });
    }
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : generations.length === 0 ? (
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
            {generations.map((gen) => (
              <Card key={gen.id} className="bg-card/50 backdrop-blur overflow-hidden group hover:border-primary/50 transition-all">
                <div className="aspect-[3/4] relative overflow-hidden">
                  <img 
                    src={gen.generated_image} 
                    alt="Generated photoshoot"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end p-4 gap-2">
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => handleDownload(gen.generated_image, `formanova-${gen.id}.jpg`)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button size="sm" variant="destructive" className="w-full" onClick={() => handleDelete(gen.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    {new Date(gen.created_at).toLocaleDateString(undefined, { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
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
