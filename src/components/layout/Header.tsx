import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Play, Sparkles, Home } from 'lucide-react';
import formanovaLogo from '@/assets/formanova-logo.png';

export function Header() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between pl-2 pr-4 py-2">
        {/* Left: Logo + Theme Switcher - flush to corner */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center group pl-2">
            <img 
              src={formanovaLogo} 
              alt="FormaNova" 
              className="h-10 md:h-12 w-auto object-contain logo-adaptive transition-transform group-hover:scale-105"
            />
          </Link>
          <div className="h-6 w-px bg-border/50" />
          <ThemeSwitcher />
        </div>

        {/* Right: Navigation */}
        <nav className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            className="h-9 px-4 font-medium tracking-wide"
          >
            <Link to="/">
              <Home className="h-3.5 w-3.5 mr-1.5" />
              Home
            </Link>
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            className="h-9 px-4 font-medium tracking-wide"
          >
            <Link to="/studio">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Studio
            </Link>
          </Button>

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
        </nav>
      </div>
    </header>
  );
}
