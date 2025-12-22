import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import formanovaLogo from '@/assets/formanova-logo.png';

export function Header() {
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/studio', label: 'Studio' },
    { path: '/tutorial', label: 'Tutorial' },
  ];

  return (
    <>
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled 
            ? 'bg-background/95 backdrop-blur-sm border-b border-border/20' 
            : 'bg-transparent'
        }`}
      >
        <div className="flex h-20 md:h-24 items-center justify-between px-6 md:px-12 lg:px-20">
          {/* Left side: Theme Switcher + Logo */}
          <div className="flex items-center gap-4 md:gap-6">
            {/* Theme Switcher - Left side */}
            <div className="hidden md:block">
              <ThemeSwitcher />
            </div>
            
            {/* Logo - Bigger and prominent */}
            <Link 
              to="/" 
              className="flex items-center group relative z-10"
            >
              <img 
                src={formanovaLogo} 
                alt="FormaNova" 
                className="h-10 md:h-14 lg:h-16 w-auto object-contain logo-adaptive transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
          </div>

          {/* Desktop Navigation - Marta Style */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path}
                className={`marta-label marta-link transition-colors duration-300 ${
                  location.pathname === link.path 
                    ? 'text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-3">
            <ThemeSwitcher />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="relative z-10"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay - Marta Style */}
      <div 
        className={`fixed inset-0 z-40 bg-background transition-all duration-500 md:hidden ${
          isMobileMenuOpen 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <nav className="flex flex-col items-center justify-center h-full gap-8">
          {navLinks.map((link, index) => (
            <Link 
              key={link.path}
              to={link.path}
              className={`font-display text-4xl tracking-wide transition-all duration-500 ${
                location.pathname === link.path 
                  ? 'text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              } ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isMobileMenuOpen ? `${index * 100 + 200}ms` : '0ms' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-20 md:h-24" />
    </>
  );
}
