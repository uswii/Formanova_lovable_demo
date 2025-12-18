import React from 'react';

interface ModelSilhouetteProps {
  className?: string;
}

export const ModelSilhouette: React.FC<ModelSilhouetteProps> = ({ className = "h-8 w-8" }) => {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      {/* Head */}
      <ellipse cx="12" cy="5" rx="3" ry="3.5" />
      {/* Hat brim */}
      <ellipse cx="12" cy="2.5" rx="6" ry="1.5" />
      {/* Hat top */}
      <ellipse cx="12" cy="1.5" rx="3.5" ry="1" />
      {/* Neck */}
      <path d="M10.5 8 L13.5 8 L13 10 L11 10 Z" />
      {/* Body/dress */}
      <path d="M8 10 Q12 9 16 10 L17 22 Q12 23 7 22 Z" />
      {/* Arms/hands on hips */}
      <path d="M8 10 Q5 12 4 15 Q5 15.5 6 15 Q7 13 8.5 12" />
      <path d="M16 10 Q19 12 20 15 Q19 15.5 18 15 Q17 13 15.5 12" />
    </svg>
  );
};
