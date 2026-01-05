import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Menu, X, LogIn, LogOut, User, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CreditsDisplay } from '@/components/CreditsDisplay';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import formanovaLogo from '@/assets/formanova-logo.png';

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
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
        <div className="flex h-16 md:h-20 items-center justify-between px-4 md:px-8 lg:px-12">
          {/* Left side: Logo first, then Theme Switcher */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Logo - First at corner */}
            <Link 
              to="/" 
              className="flex items-center group relative z-10"
            >
              <img 
                src={formanovaLogo} 
                alt="FormaNova" 
                className="h-10 md:h-12 lg:h-14 w-auto object-contain logo-adaptive transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
            
            {/* Theme Switcher - After logo */}
            <div className="hidden md:block">
              <ThemeSwitcher />
            </div>
          </div>

          {/* Desktop Navigation - Marta Style */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link 
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === link.path 
                    ? 'text-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
            
            {/* User Profile / Auth Button */}
            {user ? (
              <div className="flex items-center gap-3">
                {/* Credits Display */}
                <CreditsDisplay variant="compact" />
                
                {/* Avatar Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-full">
                      {user.user_metadata?.avatar_url ? (
                        <img 
                          src={user.user_metadata.avatar_url} 
                          alt={user.user_metadata?.full_name || 'User'} 
                          className="h-8 w-8 rounded-full object-cover border border-border hover:border-foreground transition-colors"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors border border-border">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.user_metadata?.full_name || user.email?.split('@')[0]}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <DropdownMenuItem 
                      onClick={() => navigate('/dashboard')}
                      className="cursor-pointer text-sm"
                    >
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => signOut()}
                      className="cursor-pointer text-sm text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                asChild
                className="gap-2"
              >
                <Link to="/auth">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )}
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
          
          {/* Mobile User Profile / Auth Button */}
          {user ? (
            <div 
              className={`flex flex-col items-center gap-4 transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isMobileMenuOpen ? `${navLinks.length * 100 + 200}ms` : '0ms' }}
            >
              <CreditsDisplay variant="default" />
              
              <Link to="/dashboard" className="flex items-center gap-3">
                {user.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt={user.user_metadata?.full_name || 'User'} 
                    className="h-12 w-12 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <span className="text-lg font-medium text-foreground">
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </span>
              </Link>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                >
                  <Link to="/dashboard" className="gap-2">
                    <LayoutDashboard className="h-5 w-5" />
                    Dashboard
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => signOut()}
                  className="gap-2"
                >
                  <LogOut className="h-5 w-5" />
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <Link
              to="/auth"
              className={`transition-all duration-500 ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isMobileMenuOpen ? `${navLinks.length * 100 + 200}ms` : '0ms' }}
            >
              <Button variant="default" size="lg" className="gap-2">
                <LogIn className="h-5 w-5" />
                Sign In
              </Button>
            </Link>
          )}
        </nav>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16 md:h-20" />
    </>
  );
}
