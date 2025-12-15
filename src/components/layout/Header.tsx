import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { User, LogOut, History, Play, Sparkles } from 'lucide-react';
import formanovaLogo from '@/assets/formanova-logo.png';

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-18 items-center justify-between px-3 md:px-4 py-3">
        {/* Left: Logo + Theme Switcher */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center group">
            <img 
              src={formanovaLogo} 
              alt="FormaNova" 
              className="h-7 md:h-9 w-auto object-contain logo-adaptive transition-transform group-hover:scale-105"
            />
          </Link>
          <div className="h-6 w-px bg-border/50" />
          <ThemeSwitcher />
        </div>

        {/* Right: Navigation + Auth */}
        <nav className="flex items-center gap-2">
          {user && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="h-9 px-4 font-medium tracking-wide"
              >
                <Link to="/studio">Studio</Link>
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="h-9 px-4 font-medium tracking-wide hidden sm:inline-flex"
              >
                <Link to="/history">History</Link>
              </Button>
            </>
          )}

          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            className="h-9 px-4 font-medium tracking-wide hidden sm:inline-flex"
          >
            <Link to="/tutorial">
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Tutorial
            </Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-4 ml-2">
                  <User className="h-4 w-4 mr-2" />
                  <span className="max-w-20 truncate hidden sm:inline">
                    {user.email?.split('@')[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border-border z-50">
                <DropdownMenuItem onClick={() => navigate('/studio')} className="cursor-pointer">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Studio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/history')} className="cursor-pointer">
                  <History className="h-4 w-4 mr-2" />
                  History
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/tutorial')} className="cursor-pointer sm:hidden">
                  <Play className="h-4 w-4 mr-2" />
                  Tutorial
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="h-9 px-5 ml-2 font-medium tracking-wide">
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
