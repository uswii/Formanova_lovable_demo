import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { User, LogOut, History, PlayCircle, Sparkles } from 'lucide-react';

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Left: Theme Switcher + Logo */}
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          
          <Link to="/" className="flex items-center gap-2 group">
            <Sparkles className="h-6 w-6 text-primary transition-transform group-hover:scale-110" />
            <span className="font-display text-xl font-bold tracking-tight">
              FormaNova
            </span>
          </Link>
        </div>

        {/* Right: Navigation + Auth */}
        <div className="flex items-center gap-4">
          {user && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="gap-2"
              >
                <Link to="/studio">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Studio</span>
                </Link>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="gap-2"
              >
                <Link to="/history">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">History</span>
                </Link>
              </Button>
            </>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            className="gap-2"
          >
            <Link to="/tutorial">
              <PlayCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Tutorial</span>
            </Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-24 truncate">
                    {user.email?.split('@')[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border-border z-50">
                <DropdownMenuItem onClick={() => navigate('/history')} className="cursor-pointer">
                  <History className="h-4 w-4 mr-2" />
                  Generation History
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
