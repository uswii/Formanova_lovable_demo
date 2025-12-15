import React from 'react';
import { useTheme, themes } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Check, Palette } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const currentTheme = themes.find(t => t.name === theme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-10 px-4 gap-2.5 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all group"
        >
          <Palette className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-lg">{currentTheme?.icon}</span>
          <span className="hidden sm:inline text-sm font-medium">
            {currentTheme?.label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-64 bg-popover/95 backdrop-blur-md border-border shadow-xl z-50 p-2"
      >
        <div className="px-3 py-2 mb-2 border-b border-border/50">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Theme</p>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {themes.map((t) => (
            <DropdownMenuItem
              key={t.name}
              onClick={() => setTheme(t.name)}
              className={`flex flex-col items-center gap-1 cursor-pointer p-3 rounded-lg text-center ${
                theme === t.name 
                  ? 'bg-primary/15 border border-primary/30' 
                  : 'hover:bg-secondary/60 border border-transparent'
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              <span className="font-medium text-xs">{t.label}</span>
              {theme === t.name && (
                <Check className="h-3 w-3 text-primary absolute top-1 right-1" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
