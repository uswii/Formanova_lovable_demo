import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
  colored?: boolean;
}

const defaultProps = { size: 24 };

// Theme colors for each icon
const themeColors: Record<string, string> = {
  light: '#f59e0b',      // Warm amber/gold
  dark: '#6366f1',       // Indigo/slate blue
  neon: '#00d4ff',       // Electric cyan
  nostalgia: '#d97706',  // Warm sepia/amber
  cutie: '#a855f7',      // Soft purple/lavender
  cyberpunk: '#ec4899',  // Hot pink
  retro: '#22c55e',      // Arcade green
  vintage: '#b45309',    // Warm brown
  fashion: '#fbbf24',    // Gold
  kawaii: '#f472b6',     // Sakura pink
  luxury: '#be123c',     // Burgundy/rose
  synthwave: '#f97316',  // Sunset orange
};

// Light: Half-circle/open arc suggesting brightness
export const LightIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.light : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3v2" />
    <path d="M12 19v2" />
    <path d="M5.64 5.64l1.41 1.41" />
    <path d="M16.95 16.95l1.41 1.41" />
    <path d="M3 12h2" />
    <path d="M19 12h2" />
    <path d="M5.64 18.36l1.41-1.41" />
    <path d="M16.95 7.05l1.41-1.41" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

// Dark: Crescent using negative space
export const DarkIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.dark : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
  </svg>
);

// Neon: Angular lightning-inspired, abstract thin outline
export const NeonIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.neon : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
);

// Nostalgia: Soft rounded frame, analog warmth
export const NostalgiaIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.nostalgia : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 6v1" />
    <path d="M12 17v1" />
    <path d="M6 12h1" />
    <path d="M17 12h1" />
  </svg>
);

// Cutie: Simple outlined heart, subtle and understated
export const CutieIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.cutie : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 6.5C10.5 4.5 7 4 5 6.5S4.5 12 12 19c7.5-7 8-9.5 7-12.5S13.5 4.5 12 6.5z" />
  </svg>
);

// Cyberpunk: Hexagon/circuit-inspired
export const CyberpunkIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.cyberpunk : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
    <path d="M12 8v8" />
    <path d="M8 10l4 2 4-2" />
  </svg>
);

// Retro Game: Pixel grid element
export const RetroGameIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.retro : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="5" height="5" />
    <rect x="10" y="4" width="5" height="5" />
    <rect x="4" y="10" width="5" height="5" />
    <rect x="10" y="10" width="5" height="5" />
    <rect x="15" y="10" width="5" height="5" />
    <rect x="10" y="15" width="5" height="5" />
  </svg>
);

// Vintage: Thin circular seal/ring
export const VintageIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.vintage : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <path d="M12 3v2" />
    <path d="M12 19v2" />
    <path d="M3 12h2" />
    <path d="M19 12h2" />
  </svg>
);

// High Fashion: Sparkle/star, thin intersecting lines
export const FashionIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.fashion : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2v20" />
    <path d="M2 12h20" />
    <path d="M4.93 4.93l14.14 14.14" />
    <path d="M19.07 4.93L4.93 19.07" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

// Kawaii: Minimal flower with rounded petals
export const KawaiiIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.kawaii : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="12" cy="6" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="12" r="2.5" />
  </svg>
);

// Luxury: Diamond/rhombus outline
export const LuxuryIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.luxury : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 3h12l3 6-9 12-9-12 3-6z" />
    <path d="M3 9h18" />
    <path d="M12 21V9" />
    <path d="M9 3l3 6 3-6" />
  </svg>
);

// Synthwave: Diagonal grid lines, 80s digital aesthetic
export const SynthwaveIcon = ({ className, size = defaultProps.size, colored }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? themeColors.synthwave : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 21h18" />
    <path d="M5 21l7-14 7 14" />
    <path d="M7.5 17h9" />
    <path d="M9.5 13h5" />
    <path d="M11 9h2" />
  </svg>
);

// Map theme names to icon components
export const themeIcons: Record<string, React.FC<IconProps>> = {
  light: LightIcon,
  dark: DarkIcon,
  neon: NeonIcon,
  nostalgia: NostalgiaIcon,
  cutie: CutieIcon,
  cyberpunk: CyberpunkIcon,
  retro: RetroGameIcon,
  vintage: VintageIcon,
  fashion: FashionIcon,
  kawaii: KawaiiIcon,
  luxury: LuxuryIcon,
  synthwave: SynthwaveIcon,
};

// Export colors for external use
export { themeColors };

// Generic component that renders the appropriate theme icon
export const ThemeIcon = ({ theme, className, size, colored = true }: IconProps & { theme: string }) => {
  const IconComponent = themeIcons[theme];
  if (!IconComponent) return null;
  return <IconComponent className={className} size={size} colored={colored} />;
};
