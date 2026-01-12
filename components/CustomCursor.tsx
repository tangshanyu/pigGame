import React, { useEffect, useState } from 'react';

interface CustomCursorProps {
  isClicking: boolean;
}

const CustomCursor: React.FC<CustomCursorProps> = ({ isClicking }) => {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', updatePosition);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', updatePosition);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isVisible]);

  // Mobile check to avoid custom cursor on touch devices where it lags or confuses
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouchDevice) return null;

  return (
    <div
      className="fixed pointer-events-none z-50 flex items-center justify-center"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-20%, -20%)', // Offset so the mallet head hits the target
        opacity: isVisible ? 1 : 0,
      }}
    >
      {/* Container for rotation */}
      <div className={`relative transition-transform duration-75 ${isClicking ? '-rotate-45 translate-y-4 translate-x-[-10px]' : 'rotate-0'}`}>
        {/* The Calf Face (Small icon near handle) */}
        <div className="absolute -left-8 top-12 text-4xl filter drop-shadow-lg z-10">
          🐮
        </div>
        
        {/* The Mallet */}
        <div className="relative">
          {/* Handle */}
          <div className="w-4 h-24 bg-amber-700 rounded-full border-2 border-amber-900 mx-auto shadow-sm"></div>
          {/* Head */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-12 bg-amber-200 rounded-lg border-4 border-amber-800 shadow-xl flex items-center justify-center">
            <span className="text-amber-900 opacity-50 text-xs font-bold">100T</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomCursor;
