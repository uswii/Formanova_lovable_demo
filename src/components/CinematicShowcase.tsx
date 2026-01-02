import React, { useRef } from 'react';

export function CinematicShowcase() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="w-full">
      {/* Video container - tall aspect ratio to avoid cropping */}
      <div className="relative aspect-[9/16] md:aspect-[3/4] lg:aspect-[4/5] max-h-[80vh] mx-auto rounded-2xl overflow-hidden bg-black/5">
        <video
          ref={videoRef}
          src="/videos/features-showcase.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  );
}
