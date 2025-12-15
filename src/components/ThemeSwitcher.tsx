import React from 'react';
import { useTheme, themes } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const currentTheme = themes.find(t => t.name === theme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-9 px-3 gap-2 hover:bg-secondary/60 transition-colors"
        >
          <span className="text-base">{currentTheme?.icon}</span>
          <span className="hidden md:inline text-sm font-medium tracking-wide">
            {currentTheme?.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-52 bg-popover border-border z-50 p-1"
      >
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.name}
            onClick={() => setTheme(t.name)}
            className={`flex items-center gap-3 cursor-pointer px-3 py-2.5 rounded-sm ${
              theme === t.name ? 'bg-secondary/80' : ''
            }`}
          >
            <span className="text-base w-6 text-center">{t.icon}</span>
            <div className="flex-1">
              <span className="font-medium text-sm">{t.label}</span>
            </div>
            {theme === t.name && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
