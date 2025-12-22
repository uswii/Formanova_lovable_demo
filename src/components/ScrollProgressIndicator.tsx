import React, { useEffect, useState } from 'react';

export function ScrollProgressIndicator() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
      setProgress(scrollProgress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="scroll-progress-track">
      <div 
        className="scroll-progress-bar"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
