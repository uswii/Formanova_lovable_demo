import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeDecorations() {
  const { theme } = useTheme();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {theme === 'neon' && <NeonDecorations />}
      {theme === 'synthwave' && <SynthwaveDecorations />}
      {theme === 'cyberpunk' && <CyberpunkDecorations />}
      {theme === 'kawaii' && <KawaiiDecorations />}
      {theme === 'cutie' && <CutieDecorations />}
      {theme === 'retro' && <RetroDecorations />}
      {theme === 'nostalgia' && <NostalgiaDecorations />}
      {theme === 'luxury' && <LuxuryDecorations />}
      {theme === 'fashion' && <FashionDecorations />}
      {theme === 'vintage' && <VintageDecorations />}
    </div>
  );
}

function NeonDecorations() {
  return (
    <>
      {/* Glowing horizontal lines */}
      <div className="absolute top-20 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <div className="absolute top-40 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
      <div className="absolute bottom-32 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
      
      {/* Corner glow effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      
      {/* Electric sparks */}
      <svg className="absolute top-32 right-20 w-6 h-6 text-cyan-400 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
      </svg>
      <svg className="absolute bottom-48 left-16 w-4 h-4 text-cyan-400/60 animate-pulse" style={{ animationDelay: '0.5s' }} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
      </svg>
    </>
  );
}

function SynthwaveDecorations() {
  return (
    <>
      {/* Sunset gradient bar */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-pink-500/20 via-purple-500/10 to-transparent" />
      
      {/* Retro grid */}
      <div className="absolute bottom-0 left-0 right-0 h-48 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(320 100% 62% / 0.3) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(320 100% 62% / 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'bottom'
        }}
      />
      
      {/* Sun glow */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-64 h-32 bg-gradient-to-b from-yellow-400/20 via-orange-500/15 to-pink-500/10 rounded-full blur-2xl" />
      
      {/* Horizontal scan lines */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)'
        }}
      />
    </>
  );
}

function CyberpunkDecorations() {
  return (
    <>
      {/* Circuit lines */}
      <svg className="absolute top-0 left-0 w-full h-full opacity-10" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M0,20 L30,20 L35,25 L60,25 L65,20 L100,20" stroke="currentColor" strokeWidth="0.2" fill="none" className="text-cyan-400" />
        <path d="M0,80 L20,80 L25,75 L40,75 L45,80 L100,80" stroke="currentColor" strokeWidth="0.2" fill="none" className="text-pink-500" />
        <circle cx="35" cy="25" r="1" fill="currentColor" className="text-cyan-400" />
        <circle cx="65" cy="20" r="1" fill="currentColor" className="text-cyan-400" />
      </svg>
      
      {/* Glitch corners */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-pink-500/40" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-cyan-400/40" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-cyan-400/40" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-pink-500/40" />
      
      {/* Neon glow blobs */}
      <div className="absolute top-1/4 right-10 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-10 w-48 h-48 bg-cyan-400/10 rounded-full blur-3xl" />
    </>
  );
}

function KawaiiDecorations() {
  return (
    <>
      {/* Sparkles */}
      {[...Array(8)].map((_, i) => (
        <svg
          key={i}
          className="absolute text-pink-400/60 animate-pulse"
          style={{
            top: `${10 + (i * 12)}%`,
            left: `${5 + (i % 4) * 25}%`,
            width: `${12 + (i % 3) * 6}px`,
            height: `${12 + (i % 3) * 6}px`,
            animationDelay: `${i * 0.3}s`
          }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
        </svg>
      ))}
      
      {/* Floating hearts */}
      <svg className="absolute top-20 right-16 w-5 h-5 text-pink-300/50 animate-float" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
      <svg className="absolute bottom-32 left-20 w-4 h-4 text-yellow-300/50 animate-float" style={{ animationDelay: '1s' }} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
      
      {/* Soft gradient blobs */}
      <div className="absolute top-10 right-20 w-64 h-64 bg-pink-300/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-48 h-48 bg-mint-300/10 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(152, 245, 225, 0.1)' }} />
    </>
  );
}

function CutieDecorations() {
  return (
    <>
      {/* Soft bubbles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-gradient-to-br from-purple-300/20 to-pink-300/20 animate-float"
          style={{
            width: `${30 + i * 15}px`,
            height: `${30 + i * 15}px`,
            top: `${15 + i * 14}%`,
            left: `${8 + (i % 3) * 35}%`,
            animationDelay: `${i * 0.5}s`
          }}
        />
      ))}
      
      {/* Stars */}
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className="absolute text-purple-400/40 animate-pulse"
          style={{
            top: `${20 + i * 18}%`,
            right: `${10 + (i % 3) * 12}%`,
            width: `${10 + (i % 2) * 6}px`,
            animationDelay: `${i * 0.4}s`
          }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
      
      {/* Dreamy gradient */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-lavender-400/10 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(196, 181, 253, 0.1)' }} />
    </>
  );
}

function RetroDecorations() {
  return (
    <>
      {/* Pixel corner borders */}
      <div className="absolute top-4 left-4 w-24 h-24">
        <div className="absolute top-0 left-0 w-full h-2 bg-green-500/40" style={{ imageRendering: 'pixelated' }} />
        <div className="absolute top-0 left-0 w-2 h-full bg-green-500/40" />
      </div>
      <div className="absolute top-4 right-4 w-24 h-24">
        <div className="absolute top-0 right-0 w-full h-2 bg-yellow-500/40" />
        <div className="absolute top-0 right-0 w-2 h-full bg-yellow-500/40" />
      </div>
      <div className="absolute bottom-4 left-4 w-24 h-24">
        <div className="absolute bottom-0 left-0 w-full h-2 bg-yellow-500/40" />
        <div className="absolute bottom-0 left-0 w-2 h-full bg-yellow-500/40" />
      </div>
      <div className="absolute bottom-4 right-4 w-24 h-24">
        <div className="absolute bottom-0 right-0 w-full h-2 bg-green-500/40" />
        <div className="absolute bottom-0 right-0 w-2 h-full bg-green-500/40" />
      </div>
      
      {/* Scanlines */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.1) 2px, rgba(0,255,0,0.1) 4px)'
        }}
      />
      
      {/* Pixel art stars */}
      <div className="absolute top-16 right-24 w-3 h-3 bg-green-400/60" />
      <div className="absolute top-32 left-20 w-2 h-2 bg-yellow-400/60" />
      <div className="absolute bottom-40 right-32 w-2 h-2 bg-red-400/60" />
    </>
  );
}

function NostalgiaDecorations() {
  return (
    <>
      {/* Film grain overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }}
      />
      
      {/* Sepia vignette */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-amber-900/20" 
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(120, 80, 40, 0.15) 100%)' }}
      />
      
      {/* Warm light leak */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-400/10 rounded-full blur-3xl" />
    </>
  );
}

function LuxuryDecorations() {
  return (
    <>
      {/* Subtle diamond pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0L40 20L20 40L0 20z' fill='none' stroke='%23C9A96E' stroke-width='0.5'/%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Rose gold accent lines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-400/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-400/30 to-transparent" />
      
      {/* Elegant corner accents */}
      <div className="absolute top-8 left-8 w-20 h-20 border-l border-t border-rose-400/20" />
      <div className="absolute bottom-8 right-8 w-20 h-20 border-r border-b border-rose-400/20" />
      
      {/* Warm ambient glow */}
      <div className="absolute top-1/3 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl" />
    </>
  );
}

function FashionDecorations() {
  return (
    <>
      {/* Bold geometric lines */}
      <div className="absolute top-0 left-1/4 w-px h-32 bg-gradient-to-b from-yellow-500/40 to-transparent" />
      <div className="absolute top-0 right-1/3 w-px h-48 bg-gradient-to-b from-yellow-500/30 to-transparent" />
      <div className="absolute bottom-0 left-1/3 w-px h-40 bg-gradient-to-t from-yellow-500/30 to-transparent" />
      
      {/* Gold accent corners */}
      <div className="absolute top-6 left-6 w-12 h-12 border-l-2 border-t-2 border-yellow-500/40" />
      <div className="absolute bottom-6 right-6 w-12 h-12 border-r-2 border-b-2 border-yellow-500/40" />
      
      {/* Spotlight effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl" />
    </>
  );
}

function VintageDecorations() {
  return (
    <>
      {/* Aged paper texture */}
      <div className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }}
      />
      
      {/* Warm corners */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-amber-600/10 to-transparent" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-tl from-amber-600/10 to-transparent" />
      
      {/* Subtle frame lines */}
      <div className="absolute inset-8 border border-amber-700/10 rounded-sm" />
    </>
  );
}
