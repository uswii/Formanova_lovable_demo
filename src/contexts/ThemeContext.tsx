import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeName = 
  | 'light' 
  | 'dark' 
  | 'cyberpunk' 
  | 'retro' 
  | 'vintage' 
  | 'fashion' 
  | 'kawaii' 
  | 'luxury' 
  | 'synthwave'
  | 'neon'
  | 'cutie';

interface ThemeConfig {
  name: ThemeName;
  label: string;
  icon: string;
  description: string;
}

export const themes: ThemeConfig[] = [
  { name: 'light', label: 'Light', icon: '☀️', description: 'Clean & Professional' },
  { name: 'dark', label: 'Dark', icon: '🌙', description: 'Deep Slate Blues' },
  { name: 'neon', label: 'Neon', icon: '⚡', description: 'Electric Blue' },
  { name: 'cutie', label: 'Cutie', icon: '💜', description: 'Soft Pastel' },
  { name: 'cyberpunk', label: 'Cyberpunk', icon: '🌆', description: 'Neon Pink & Cyan' },
  { name: 'retro', label: 'Retro Game', icon: '🎮', description: '8-bit Arcade' },
  { name: 'vintage', label: 'Vintage', icon: '📷', description: 'Warm Americana' },
  { name: 'fashion', label: 'High Fashion', icon: '✨', description: 'Black & Gold' },
  { name: 'kawaii', label: 'Kawaii', icon: '🌸', description: 'Cute & Playful' },
  { name: 'luxury', label: 'Luxury', icon: '👑', description: 'Champagne Elegance' },
  { name: 'synthwave', label: 'Synthwave', icon: '🌃', description: 'Retro-Futuristic' },
];

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('formanova-theme') as ThemeName;
      if (stored && themes.find(t => t.name === stored)) {
        return stored;
      }
    }
    return 'dark';
  });

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    localStorage.setItem('formanova-theme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    themes.forEach(t => {
      root.removeAttribute('data-theme');
      root.classList.remove(t.name);
    });
    
    // Apply the new theme
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme !== 'light') {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
