import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Generation {
  id: string;
  created_at: string;
  original_image: string;
  generated_image: string;
  prompt: string | null;
}

const ITEMS_PER_PAGE = 10;

export default function Generations() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGenerations();
    }
  }, [user, currentPage]);

  const fetchGenerations = async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Get total count
    const { count } = await supabase
      .from('generations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    setTotalCount(count || 0);
    
    // Get paginated data
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    
    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to);
    
    if (!error && data) {
      setGenerations(data);
    }
    
    setLoading(false);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-display mb-8">My Generations</h1>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : generations.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">No generations yet</p>
              <Button asChild className="mt-4">
                <Link to="/studio">Create your first generation</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {generations.map((gen) => (
                <Card key={gen.id} className="border-border/50 bg-card/50 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-2 gap-1">
                      <div className="aspect-square bg-muted">
                        <img 
                          src={gen.original_image} 
                          alt="Original" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="aspect-square bg-muted">
                        <img 
                          src={gen.generated_image} 
                          alt="Generated" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground">
                        {new Date(gen.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {gen.prompt && (
                        <p className="text-sm text-foreground mt-2 line-clamp-2">{gen.prompt}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
