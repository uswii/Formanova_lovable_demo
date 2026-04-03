import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  type UserType,
  isOnboardingComplete,
  markOnboardingComplete,
  saveUserType,
} from '@/lib/onboarding-api';
import { isOnboardingWelcomeEnabled } from '@/lib/feature-flags';
import { trackUserTypeSelected } from '@/lib/posthog-events';

// ---------------------------------------------------------------------------
// Inline SVG icons — all use currentColor so they adapt to any theme.
// White details replaced with hsl(var(--primary-foreground)) so they stay
// visible even when the primary color is light/white.
// ---------------------------------------------------------------------------

type IconProps = { className?: string };

function JewelryBrandIcon({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 466.66" fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M410.93 171.33c-18.55 35.3-84.75 35.3-103.29 0-18.55 35.3-84.75 35.3-103.3 0-18.55 35.3-84.74 35.3-103.29 0C80.67 210.13.29 205.52.29 148.62c0-3.06-1.01-19.02.72-22.11l34.6-110.85C38.46 6.53 45.4.67 58.85.01L450.42 0c12.08 1.3 19.94 6.37 23.19 15.56l37.25 110.8c1.92 3.19.83 18.88.83 22.26 0 58.28-81.8 58.8-100.76 22.71zm66.14 47.75v220.49c0 7.43-3.06 14.22-7.97 19.12-4.9 4.9-11.69 7.97-19.12 7.97H62c-7.41 0-14.18-3.06-19.09-7.96h-.04c-4.9-4.9-7.96-11.67-7.96-19.13V219.3c7.5 1.4 15.11 1.81 22.37 1.5v218.77c0 1.28.55 2.46 1.4 3.31.84.87 2.03 1.4 3.32 1.4h84.96c-2.92-7.68-5.62-15.47-8.09-23.36-3.43-10.9-6.42-22.1-8.97-33.66a385.534 385.534 0 0 1-6.1-35.14l-.4-3.01c-2.75-21.1-5.69-43.66 14.73-54.09 6-3.05 15.03-5.09 21.75-6.86 3.12-.83 6.08-1.57 8.89-2.25.42 1.67.89 3.31 1.41 4.93a17.07 17.07 0 0 0-5.1 12.18c0 9.44 7.65 17.09 17.1 17.09 1.19 0 2.35-.12 3.47-.36a91.002 91.002 0 0 0 14.72 14.64 16.98 16.98 0 0 0-.48 4c0 9.44 7.66 17.09 17.09 17.09 5.14 0 9.73-2.26 12.87-5.84l-.16.17c2.93.91 5.91 1.67 8.96 2.27l-26.97 26.96-4.01 4.02 48.32 48.33 48.33-48.33-30.87-30.87c3.05-.59 6.05-1.33 8.99-2.22 3.12 3.39 7.59 5.51 12.56 5.51 9.44 0 17.09-7.65 17.09-17.09 0-1.22-.12-2.41-.37-3.56.64-.49 1.27-1 1.9-1.51a90.93 90.93 0 0 0 13.29-13.46c.95.17 1.91.25 2.9.25 9.44 0 17.09-7.65 17.09-17.09 0-4.5-1.74-8.6-4.59-11.65a92 92 0 0 0 1.3-4.38l17.53 4.58c8.98 2.35 11.49 1.94 18.38 8.52 16.88 16.13 10.7 41.49 5.27 63.77-.92 3.77-1.8 7.44-2.56 11.07-4.99 23.7-11.28 46.88-19.26 69.35h87.01c1.26 0 2.44-.54 3.3-1.4.87-.87 1.41-2.05 1.41-3.31V219.76c7.41.61 14.96.5 22.38-.68zm-297.32 64.05c15.42-4.33 25.5-10.28 36.17-34.59a5.733 5.733 0 0 1 5.28-3.46v-.02h70.52c2.63 0 4.86 1.77 5.55 4.18 2.73 7.57 5.97 14.26 9.92 19.72 3.74 5.14 8.12 9.23 13.41 12.03l12.05 3.14-.56 1.95c-.74-.1-1.5-.15-2.28-.15-9.44 0-17.09 7.65-17.09 17.09 0 4.29 1.58 8.21 4.19 11.21a79.45 79.45 0 0 1-10.47 10.36c-.22.18-.44.36-.66.53A17.024 17.024 0 0 0 295 321.3c-9.44 0-17.09 7.65-17.09 17.09 0 .37.01.73.04 1.09a78.235 78.235 0 0 1-14.54 2.67c-4.98.34-9.89.24-14.78-.05-5.01-.49-9.89-1.44-14.58-2.81-.09 1.69.02-.43.02-.9 0-9.44-7.65-17.09-17.09-17.09-3.93 0-7.55 1.32-10.43 3.55-4.06-3.3-7.79-6.99-11.13-11.02l-.02.01c2.42-2.94 3.87-6.71 3.87-10.82 0-9.44-7.66-17.09-17.09-17.09-.56 0-1.11.03-1.65.08.01 0-.71-2.6-.78-2.88zm150.06 11.68a8.209 8.209 0 1 1 0 16.42 8.209 8.209 0 1 1 0-16.42zm-147.63 0c4.53 0 8.2 3.68 8.2 8.21 0 4.54-3.67 8.21-8.2 8.21-4.54 0-8.22-3.67-8.22-8.21 0-4.53 3.68-8.21 8.22-8.21zm34.8 35.37c4.54 0 8.21 3.68 8.21 8.21 0 4.53-3.67 8.21-8.21 8.21-4.53 0-8.2-3.68-8.2-8.21 0-4.53 3.67-8.21 8.2-8.21zm78.02 0c4.54 0 8.21 3.68 8.21 8.21a8.209 8.209 0 1 1-16.42 0c0-4.53 3.68-8.21 8.21-8.21zm-66.77 52.88 27.76-27.76 27.77 27.76-27.77 27.77-27.76-27.77z" />
    </svg>
  );
}

function FreelancerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 89.39 122.88" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M38.29,2c4.58-3.1,9.8-2.42,14.11,0.87c1.13,0.87,2.1,1.93,2.87,3.22c0.65,1.1,1.8,3.34-0.34,3.69 c-0.84,0.14-2.32-1.01-3.45-1.38c-1.46-0.47-2.96-0.78-4.45-0.93c-2.78-0.29-5.51-0.06-7.86,0.59c-1.28,0.35-2.51,0.78-3.7,1.33 c-0.55,0.26-1.68,1.01-1.99,0.04C32.76,7.19,36.64,3.11,38.29,2L38.29,2z M3.52,79.63h6.54c3.28-5.1,10.34-7.76,16.65-10.14 c1.26-0.48,2.49-0.94,3.65-1.41l0.02-0.02c1.07-0.91,2.17-2,3.04-2.97c0.64-0.72,1.15-1.34,1.42-1.74 c-0.22-0.19-0.45-0.38-0.67-0.59c-1.62-1.46-3.09-3.27-4.42-5.37c-1.23-1.95-2.34-4.16-3.34-6.6c-0.44-0.13-0.86-0.29-1.26-0.48 c-0.57-0.27-1.09-0.58-1.56-0.94c-1.39-1.06-2.3-2.51-2.84-4.1c-0.59-1.78-0.7-3.74-0.46-5.55c0.13-0.94,0.39-1.75,0.78-2.43 c0.41-0.71,0.96-1.29,1.64-1.73c0.2-0.13,0.43-0.18,0.65-0.16c-0.39-2-0.33-3.91-0.24-6.16c0.21-5.87,1.7-10.56,6.33-14.63 c6.98-6.14,20.79-6.67,28.48-1.39c1.14,0.79,2.2,1.72,3.15,2.81c3.12,3.58,5.89,11.44,5.84,16.28c-0.01,1.12-0.2,2.26-0.58,3.42 c-0.02,0.11-0.04,0.24-0.07,0.38c0.85,0.53,1.51,1.18,1.99,1.92l0,0c0.72,1.1,1.03,2.36,0.96,3.69c-0.07,1.28-0.51,2.63-1.31,3.94 c-0.92,1.52-2.34,3.01-4.22,4.3c-1.64,3.83-3.94,7.67-6.72,10.75c-0.89,0.99-1.84,1.9-2.83,2.71c0.8,0.86,2.28,2.14,3.69,3.35 c0.25,0.21,0.5,0.43,0.75,0.65c1.35,0.61,2.67,1.15,3.99,1.7c5.89,2.41,11.88,4.87,14.99,10.51h8.32c2.1,0,3.8,1.96,3.48,4.36 l-4.55,34.53c-0.31,2.38-1.96,4.36-4.36,4.36H8.95c-2.4,0-4.05-1.98-4.36-4.36L0.04,83.99C-0.28,81.6,1.42,79.63,3.52,79.63 L3.52,79.63z M13.85,79.63h60.16c-2.86-3.79-7.75-5.79-12.57-7.77c-1.01-0.41-2.01-0.82-2.97-1.24c-0.8,1.09-1.78,2.04-2.89,2.84 c-2.66,1.93-6.1,3.04-9.65,3.21c-3.53,0.17-7.19-0.58-10.31-2.38c-1.56-0.9-2.98-2.05-4.18-3.46c-1.17,0.48-2.42,0.94-3.69,1.43 C22.66,74.2,17.05,76.32,13.85,79.63L13.85,79.63z M44.3,95.9c2.89,0,5.23,2.34,5.23,5.23c0,2.89-2.34,5.23-5.23,5.23 c-2.89,0-5.23-2.34-5.23-5.23C39.07,98.24,41.41,95.9,44.3,95.9L44.3,95.9z M41.69,58.01c-0.48-0.29-0.63-0.92-0.34-1.4 c0.29-0.48,0.92-0.63,1.4-0.34c0.77,0.47,1.53,0.72,2.27,0.75c0.74,0.03,1.49-0.15,2.25-0.55c0.5-0.26,1.12-0.06,1.38,0.44 c0.26,0.5,0.06,1.12-0.44,1.38c-1.08,0.56-2.17,0.82-3.27,0.77C43.85,59.01,42.76,58.66,41.69,58.01L41.69,58.01z M53.94,40.98 c1.44,0,2.6,1.17,2.6,2.6c0,1.44-1.17,2.6-2.6,2.6s-2.6-1.17-2.6-2.6C51.33,42.14,52.5,40.98,53.94,40.98L53.94,40.98z M36.04,40.98c1.44,0,2.6,1.17,2.6,2.6c0,1.44-1.17,2.6-2.6,2.6c-1.44,0-2.6-1.17-2.6-2.6C33.44,42.14,34.6,40.98,36.04,40.98 L36.04,40.98z M23.88,37.34l-0.02,0.01c-0.39,0.25-0.7,0.58-0.94,1c-0.26,0.45-0.43,1-0.52,1.66c-0.2,1.51-0.11,3.14,0.37,4.6 c0.4,1.21,1.09,2.3,2.11,3.09c0.36,0.28,0.75,0.51,1.17,0.71c0.43,0.2,0.89,0.36,1.39,0.48c0.35,0.08,0.61,0.33,0.74,0.64l0,0 c1.01,2.52,2.12,4.78,3.36,6.75c1.22,1.94,2.57,3.59,4.05,4.93c1.58,1.43,3.14,2.43,4.67,3.07c2.81,1.18,5.51,1.11,8.02,0.18 c2.58-0.95,4.98-2.81,7.1-5.16c2.68-2.97,4.89-6.71,6.46-10.44c0.1-0.23,0.27-0.41,0.47-0.52c1.71-1.14,2.97-2.44,3.77-3.76 c0.61-1,0.94-2.01,1-2.95c0.05-0.89-0.15-1.72-0.61-2.42l0,0l0,0c-0.25-0.37-0.56-0.72-0.96-1.02c-0.8,1.81-2.14,4.2-3.87,6.57 V33.9c-4.98-2.31-8.23-7.37-9.89-14.99c-1.99,14.5-19.79,13.87-24.27,16.52v8.46c-0.85-1.19-1.61-2.41-2.3-3.64 C24.62,39.22,24.19,38.26,23.88,37.34L23.88,37.34z M36.46,64.58c-0.37,0.54-0.9,1.19-1.52,1.88c-0.52,0.58-1.12,1.2-1.75,1.8 c1.08,1.46,2.42,2.61,3.91,3.47c2.61,1.5,5.7,2.13,8.69,1.99c2.98-0.15,5.84-1.06,8.04-2.66c1.06-0.77,1.96-1.7,2.63-2.76 c-1.5-1.29-3.07-2.66-3.98-3.65c-1.11,0.74-2.27,1.35-3.48,1.79c-3,1.11-6.23,1.19-9.58-0.22C38.45,65.81,37.46,65.27,36.46,64.58 L36.46,64.58z" />
    </svg>
  );
}

function AIResearcherIcon({ className }: IconProps) {
  return (
    <svg width="100%" viewBox="0 0 680 680" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Background blob */}
      <path d="M 220 98 C 285 46 488 52 552 120 C 616 188 620 322 596 420 C 572 518 482 590 376 598 C 270 606 146 562 98 478 C 50 394 60 272 106 198 C 138 148 155 150 220 98 Z" fill="currentColor" fillOpacity="0.1" />
      {/* Browser window */}
      <rect x="110" y="88" width="325" height="272" rx="22" fill="currentColor" fillOpacity="0.08" />
      <rect x="110" y="88" width="325" height="68" rx="22" fill="currentColor" />
      <rect x="110" y="134" width="325" height="22" fill="currentColor" />
      <rect x="110" y="88" width="325" height="272" rx="22" fill="none" stroke="currentColor" strokeWidth="5" />
      <circle cx="140" cy="122" r="9" fill="hsl(var(--primary-foreground))" fillOpacity="0.65" />
      <circle cx="163" cy="122" r="9" fill="hsl(var(--primary-foreground))" fillOpacity="0.65" />
      {/* Neural network connections */}
      <g stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.35">
        <line x1="178" y1="230" x2="250" y2="215" /><line x1="178" y1="230" x2="250" y2="257" />
        <line x1="178" y1="230" x2="250" y2="300" /><line x1="178" y1="285" x2="250" y2="215" />
        <line x1="178" y1="285" x2="250" y2="257" /><line x1="178" y1="285" x2="250" y2="300" />
        <line x1="250" y1="215" x2="328" y2="232" /><line x1="250" y1="215" x2="328" y2="275" />
        <line x1="250" y1="257" x2="328" y2="232" /><line x1="250" y1="257" x2="328" y2="275" />
        <line x1="250" y1="300" x2="328" y2="275" />
        <line x1="328" y1="232" x2="398" y2="253" /><line x1="328" y1="275" x2="398" y2="253" />
      </g>
      {/* Neural network nodes */}
      <circle cx="178" cy="230" r="19" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="4" />
      <circle cx="178" cy="285" r="19" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="4" />
      <circle cx="250" cy="215" r="19" fill="currentColor" fillOpacity="0.82" stroke="currentColor" strokeWidth="4" />
      <circle cx="250" cy="257" r="19" fill="currentColor" fillOpacity="0.82" stroke="currentColor" strokeWidth="4" />
      <circle cx="250" cy="300" r="19" fill="currentColor" fillOpacity="0.82" stroke="currentColor" strokeWidth="4" />
      <circle cx="328" cy="232" r="19" fill="currentColor" fillOpacity="0.82" stroke="currentColor" strokeWidth="4" />
      <circle cx="328" cy="275" r="19" fill="currentColor" fillOpacity="0.82" stroke="currentColor" strokeWidth="4" />
      <circle cx="398" cy="253" r="23" fill="currentColor" stroke="currentColor" strokeWidth="4" />
      <polyline points="387,253 394,263 409,243" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* AI book card */}
      <rect x="228" y="415" width="165" height="130" rx="20" fill="currentColor" fillOpacity="0.82" />
      <rect x="250" y="435" width="88" height="68" rx="8" fill="hsl(var(--primary-foreground))" fillOpacity="0.15" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" />
      <line x1="238" y1="452" x2="250" y2="452" stroke="hsl(var(--primary-foreground))" strokeWidth="4.5" />
      <line x1="238" y1="469" x2="250" y2="469" stroke="hsl(var(--primary-foreground))" strokeWidth="4.5" />
      <line x1="238" y1="487" x2="250" y2="487" stroke="hsl(var(--primary-foreground))" strokeWidth="4.5" />
      <line x1="338" y1="452" x2="350" y2="452" stroke="hsl(var(--primary-foreground))" strokeWidth="4.5" />
      <line x1="338" y1="469" x2="350" y2="469" stroke="hsl(var(--primary-foreground))" strokeWidth="4.5" />
      <line x1="338" y1="487" x2="350" y2="487" stroke="hsl(var(--primary-foreground))" strokeWidth="4.5" />
      <text x="295" y="480" fontSize="26" fontWeight="900" fontFamily="Arial Black, Arial, sans-serif" fill="hsl(var(--primary-foreground))" textAnchor="middle" dominantBaseline="central">AI</text>
      <rect x="228" y="415" width="165" height="130" rx="20" fill="none" stroke="currentColor" strokeWidth="5" />
      {/* Code editor card */}
      <rect x="68" y="280" width="200" height="260" rx="16" fill="currentColor" fillOpacity="0.08" />
      <rect x="68" y="280" width="200" height="260" rx="16" fill="none" stroke="currentColor" strokeWidth="5" />
      <rect x="88" y="302" width="155" height="15" rx="6" fill="currentColor" />
      <rect x="88" y="327" width="112" height="12" rx="5" fill="currentColor" fillOpacity="0.6" />
      <rect x="88" y="348" width="134" height="12" rx="5" fill="currentColor" fillOpacity="0.45" />
      <rect x="88" y="369" width="90" height="12" rx="5" fill="currentColor" fillOpacity="0.75" />
      <rect x="88" y="390" width="122" height="12" rx="5" fill="currentColor" fillOpacity="0.55" />
      <circle cx="89" cy="415" r="6.5" fill="currentColor" />
      <circle cx="89" cy="433" r="6.5" fill="currentColor" fillOpacity="0.6" />
      <circle cx="89" cy="451" r="6.5" fill="currentColor" fillOpacity="0.82" />
      <rect x="88" y="474" width="130" height="12" rx="5" fill="currentColor" fillOpacity="0.4" />
      <rect x="88" y="495" width="95" height="12" rx="5" fill="currentColor" fillOpacity="0.35" />
      {/* Arm / pencil line */}
      <line x1="490" y1="385" x2="618" y2="556" stroke="currentColor" strokeWidth="26" strokeLinecap="round" strokeOpacity="0.6" />
      {/* Large person circle */}
      <circle cx="490" cy="385" r="120" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="9" />
      {/* Mini neural network in circle */}
      <g stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.42">
        <line x1="448" y1="375" x2="483" y2="362" /><line x1="448" y1="375" x2="483" y2="392" />
        <line x1="448" y1="400" x2="483" y2="362" /><line x1="448" y1="400" x2="483" y2="392" />
        <line x1="483" y1="362" x2="524" y2="378" /><line x1="483" y1="392" x2="524" y2="378" />
      </g>
      <circle cx="448" cy="375" r="16" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="3" />
      <circle cx="448" cy="400" r="16" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="3" />
      <circle cx="483" cy="362" r="16" fill="currentColor" fillOpacity="0.82" stroke="currentColor" strokeWidth="3" />
      <circle cx="483" cy="392" r="16" fill="currentColor" fillOpacity="0.82" stroke="currentColor" strokeWidth="3" />
      <circle cx="524" cy="378" r="18" fill="currentColor" stroke="currentColor" strokeWidth="3" />
      <polyline points="515,378 520,386 534,370" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Decorative plus signs */}
      <rect x="570" y="272" width="12" height="38" rx="6" fill="currentColor" />
      <rect x="557" y="285" width="38" height="12" rx="6" fill="currentColor" />
      <rect x="614" y="398" width="55" height="13" rx="5" fill="currentColor" fillOpacity="0.8" />
      <rect x="614" y="419" width="40" height="13" rx="5" fill="currentColor" fillOpacity="0.8" />
      <rect x="614" y="440" width="49" height="13" rx="5" fill="currentColor" fillOpacity="0.8" />
      <rect x="48" y="212" width="10" height="34" rx="5" fill="currentColor" fillOpacity="0.6" />
      <rect x="34" y="226" width="34" height="10" rx="5" fill="currentColor" fillOpacity="0.6" />
      <rect x="574" y="106" width="10" height="34" rx="5" fill="currentColor" />
      <rect x="560" y="120" width="34" height="10" rx="5" fill="currentColor" />
      {/* Diamond / star decorations */}
      <polygon points="630,204 638,190 646,204 638,218" fill="currentColor" fillOpacity="0.55" />
      <polygon points="80,572 87,559 94,572 87,585" fill="currentColor" fillOpacity="0.6" />
      <polygon points="200,630 207,618 214,630 207,642" fill="currentColor" fillOpacity="0.55" />
      <polygon points="505,636 511,627 517,636 511,645" fill="currentColor" fillOpacity="0.5" />
      <polygon points="144,618 149,610 154,618 149,626" fill="currentColor" fillOpacity="0.6" />
      <path d="M 567 70 C 567 62 577 52 584 60 C 591 52 601 62 601 70 C 601 82 584 93 584 93 C 584 93 567 82 567 70 Z" fill="currentColor" />
      <path d="M 97 77 L 102 63 L 107 77 L 121 83 L 107 89 L 102 103 L 97 89 L 83 83 Z" fill="currentColor" fillOpacity="0.65" />
    </svg>
  );
}

function ContentCreatorIcon({ className }: IconProps) {
  return (
    <svg width="100%" viewBox="0 0 680 560" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <clipPath id="cc-av">
          <circle cx="340" cy="288" r="108" />
        </clipPath>
      </defs>
      {/* Hearts */}
      <path d="M172 126 C153 118 134 100 136 87 C138 72 148 68 155 76 C160 80 165 82 172 88 C179 82 184 80 189 76 C196 68 206 72 208 87 C210 100 191 118 172 126 Z" fill="currentColor" />
      <path d="M145 150 C130 142 118 128 120 118 C122 107 129 104 135 110 C139 114 142 116 145 120 C148 116 151 114 155 110 C161 104 168 107 170 118 C172 128 160 142 145 150 Z" fill="currentColor" />
      <path d="M200 134 C190 127 182 117 184 110 C186 102 191 100 196 105 C198 107 199 109 200 112 C201 109 202 107 204 105 C209 100 214 102 216 110 C218 117 210 127 200 134 Z" fill="currentColor" fillOpacity="0.72" />
      {/* Music note box */}
      <rect x="252" y="52" width="96" height="98" rx="18" fill="currentColor" />
      <ellipse cx="278" cy="122" rx="11" ry="8" fill="hsl(var(--primary-foreground))" transform="rotate(-15 278 122)" />
      <line x1="289" y1="117" x2="289" y2="78" stroke="hsl(var(--primary-foreground))" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="308" cy="116" rx="11" ry="8" fill="hsl(var(--primary-foreground))" transform="rotate(-15 308 116)" />
      <line x1="319" y1="111" x2="319" y2="74" stroke="hsl(var(--primary-foreground))" strokeWidth="4" strokeLinecap="round" />
      <line x1="289" y1="78" x2="319" y2="74" stroke="hsl(var(--primary-foreground))" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="289" y1="90" x2="319" y2="86" stroke="hsl(var(--primary-foreground))" strokeWidth="4" strokeLinecap="round" />
      {/* Chat bubble */}
      <rect x="448" y="65" width="175" height="92" rx="18" fill="currentColor" fillOpacity="0.75" />
      <polygon points="470,157 454,180 504,157" fill="currentColor" fillOpacity="0.75" />
      <rect x="448" y="65" width="175" height="92" rx="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.6" />
      <rect x="468" y="91" width="130" height="11" rx="5" fill="currentColor" fillOpacity="0.4" />
      <rect x="468" y="112" width="95" height="11" rx="5" fill="currentColor" fillOpacity="0.4" />
      {/* Photo card */}
      <rect x="62" y="152" width="130" height="112" rx="10" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <circle cx="100" cy="186" r="15" fill="currentColor" fillOpacity="0.75" />
      <polygon points="68,252 106,198 144,252" fill="currentColor" fillOpacity="0.75" />
      <polygon points="118,252 148,218 178,252" fill="currentColor" fillOpacity="0.58" />
      {/* Video player */}
      <rect x="490" y="196" width="152" height="106" rx="18" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
      <polygon points="548,228 548,270 590,249" fill="currentColor" fillOpacity="0.58" />
      {/* Hashtag icon */}
      <rect x="600" y="125" width="70" height="70" rx="18" fill="currentColor" fillOpacity="0.78" />
      <text x="635" y="160" fontSize="32" fontWeight="900" fontFamily="Arial Black, Arial, sans-serif" fill="hsl(var(--primary-foreground))" textAnchor="middle" dominantBaseline="central">#</text>
      {/* Bar chart */}
      <rect x="464" y="496" width="148" height="6" rx="3" fill="currentColor" fillOpacity="0.28" />
      <rect x="472" y="468" width="22" height="30" rx="4" fill="currentColor" fillOpacity="0.75" />
      <rect x="500" y="452" width="22" height="46" rx="4" fill="currentColor" fillOpacity="0.75" />
      <rect x="528" y="436" width="22" height="62" rx="4" fill="currentColor" fillOpacity="0.75" />
      <rect x="556" y="418" width="22" height="80" rx="4" fill="currentColor" fillOpacity="0.75" />
      {/* Trend line */}
      <polyline points="483,462 511,445 539,430 567,414" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="483" cy="462" r="5.5" fill="currentColor" stroke="hsl(var(--primary-foreground))" strokeWidth="2" />
      <circle cx="511" cy="445" r="5.5" fill="currentColor" stroke="hsl(var(--primary-foreground))" strokeWidth="2" />
      <circle cx="539" cy="430" r="5.5" fill="currentColor" stroke="hsl(var(--primary-foreground))" strokeWidth="2" />
      <circle cx="567" cy="414" r="5.5" fill="currentColor" stroke="hsl(var(--primary-foreground))" strokeWidth="2" />
      {/* Person avatar */}
      <circle cx="340" cy="288" r="112" fill="currentColor" fillOpacity="0.1" />
      <circle cx="340" cy="250" r="43" fill="currentColor" clipPath="url(#cc-av)" />
      <ellipse cx="340" cy="370" rx="80" ry="65" fill="currentColor" clipPath="url(#cc-av)" />
      <circle cx="340" cy="288" r="112" fill="none" stroke="currentColor" strokeWidth="4" strokeOpacity="0.18" />
      {/* Instagram icon */}
      <circle cx="188" cy="358" r="62" fill="currentColor" />
      <rect x="150" y="320" width="76" height="76" rx="20" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="4.5" />
      <circle cx="188" cy="358" r="21" fill="none" stroke="hsl(var(--primary-foreground))" strokeWidth="4" />
      <circle cx="212" cy="333" r="5.5" fill="hsl(var(--primary-foreground))" />
    </svg>
  );
}

function OtherIcon({ className }: IconProps) {
  return (
    <svg width="100%" viewBox="0 0 680 680" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Background blob */}
      <circle cx="340" cy="340" r="200" fill="currentColor" fillOpacity="0.08" />
      {/* Outer ring */}
      <circle cx="340" cy="340" r="180" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.18" />
      {/* Large question mark circle */}
      <circle cx="340" cy="340" r="130" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="5" strokeOpacity="0.35" />
      {/* Question mark */}
      <text x="340" y="340" fontSize="160" fontWeight="700" fontFamily="Georgia, serif" fill="currentColor" fillOpacity="0.75" textAnchor="middle" dominantBaseline="central">?</text>
      {/* Decorative dots */}
      <circle cx="180" cy="190" r="12" fill="currentColor" fillOpacity="0.45" />
      <circle cx="500" cy="180" r="8"  fill="currentColor" fillOpacity="0.35" />
      <circle cx="520" cy="490" r="14" fill="currentColor" fillOpacity="0.4"  />
      <circle cx="160" cy="500" r="9"  fill="currentColor" fillOpacity="0.3"  />
      {/* Decorative diamonds */}
      <polygon points="340,105 350,120 340,135 330,120" fill="currentColor" fillOpacity="0.55" />
      <polygon points="340,545 350,560 340,575 330,560" fill="currentColor" fillOpacity="0.55" />
      <polygon points="105,340 120,350 135,340 120,330" fill="currentColor" fillOpacity="0.55" />
      <polygon points="545,340 560,350 575,340 560,330" fill="currentColor" fillOpacity="0.55" />
      {/* Small cross decorations */}
      <rect x="595" y="220" width="8" height="26" rx="4" fill="currentColor" fillOpacity="0.5" />
      <rect x="582" y="233" width="26" height="8" rx="4" fill="currentColor" fillOpacity="0.5" />
      <rect x="78"  y="430" width="8" height="26" rx="4" fill="currentColor" fillOpacity="0.45" />
      <rect x="65"  y="443" width="26" height="8" rx="4" fill="currentColor" fillOpacity="0.45" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Role options
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: UserType; label: string; Icon: (p: IconProps) => JSX.Element }[] = [
  { value: 'jewelry_brand',      label: 'Jewelry Brand',        Icon: JewelryBrandIcon   },
  { value: 'freelancer',         label: 'Freelancer',           Icon: FreelancerIcon     },
  { value: 'researcher_student', label: 'Researcher / Student', Icon: AIResearcherIcon   },
  { value: 'content_creator',    label: 'Content Creator',      Icon: ContentCreatorIcon },
  { value: 'other',              label: 'Other',                Icon: OtherIcon          },
];

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface RoleCardProps {
  value: UserType;
  label: string;
  Icon: (p: IconProps) => JSX.Element;
  selected: boolean;
  onSelect: () => void;
}

function RoleCard({ label, Icon, selected, onSelect }: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'relative flex aspect-square w-full flex-col items-center justify-center gap-3 sm:gap-4',
        'overflow-hidden border-2 p-4 sm:p-6 lg:p-8',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? 'border-primary bg-primary/5 scale-[1.02] shadow-sm'
          : 'border-border bg-card hover:border-primary/40 hover:bg-accent/20',
      )}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
        </span>
      )}
      <Icon className="h-20 w-20 text-primary sm:h-32 sm:w-32 lg:h-40 lg:w-40" />
      <span className={cn(
        'line-clamp-2 w-full text-center text-xs font-medium leading-tight sm:text-sm',
        selected ? 'text-foreground' : 'text-muted-foreground',
      )}>
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Onboarding() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<UserType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initializing) return;
    if (user && isOnboardingComplete(user.id)) {
      navigate('/studio', { replace: true });
    }
  }, [user, initializing, navigate]);

  const handleContinue = async () => {
    if (!selected || !user || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await saveUserType(selected);
      trackUserTypeSelected({ user_type: selected });
      markOnboardingComplete(user.id);
      const dest = isOnboardingWelcomeEnabled(user.email) ? '/onboarding-welcome' : '/studio';
      navigate(dest, { replace: true });
    } catch {
      setSubmitting(false);
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center overflow-hidden px-5 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-12">
      <div className="w-full shrink-0 pb-6 text-center sm:pb-8">
        <h1 className="font-display text-3xl leading-tight tracking-wide sm:text-4xl lg:text-5xl">
          What best describes you?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Help us personalize your Formanova experience
        </p>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-5 sm:max-w-3xl sm:gap-6 lg:max-w-7xl lg:grid-cols-5 lg:gap-8">
        {ROLE_OPTIONS.map((option) => (
          <RoleCard
            key={option.value}
            {...option}
            selected={selected === option.value}
            onSelect={() => setSelected(option.value)}
          />
        ))}
      </div>

      <div className="w-full shrink-0 pt-6 pb-4 flex flex-col items-center sm:pt-8 sm:pb-8">
        {error && (
          <p className="mb-3 text-center text-sm text-destructive">{error}</p>
        )}
        <Button
          className="min-w-[200px] px-10"
          size="lg"
          disabled={!selected || submitting}
          onClick={handleContinue}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? 'Continuing…' : 'Press to Continue'}
        </Button>
      </div>

      {user?.email?.toLowerCase() === 'uswa@raresense.so' && (
        <button
          type="button"
          onClick={() => {
            if (user) {
              localStorage.removeItem('formanova_onboarding_' + user.id);
              localStorage.removeItem('formanova_tos_' + user.id);
            }
            window.location.reload();
          }}
          className="fixed bottom-4 left-4 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          ↩ reset test
        </button>
      )}
    </div>
  );
}
