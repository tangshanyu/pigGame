import React, { useState, useEffect } from 'react';
import { Mole, MoleState } from '../types';

interface HoleProps {
  mole: Mole;
  onHit: (id: number) => void;
}

const Hole: React.FC<HoleProps> = ({ mole, onHit }) => {
  const isVisible = mole.state === MoleState.VISIBLE || mole.state === MoleState.RISING;
  const isHit = mole.state === MoleState.HIT;
  const [showPow, setShowPow] = useState(false);

  // Effect to handle the "POW" visual timing
  useEffect(() => {
    if (isHit) {
      setShowPow(true);
      const timer = setTimeout(() => setShowPow(false), 300);
      return () => clearTimeout(timer);
    } else {
      setShowPow(false);
    }
  }, [isHit]);

  return (
    <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex justify-center items-end mx-auto">
      {/* The Hole Graphic */}
      <div className="absolute bottom-0 w-full h-12 bg-neutral-800 rounded-[100%] border-b-4 border-neutral-700 shadow-inner z-0"></div>
      
      {/* Masking container to make the pig appear from underground */}
      <div className="relative w-full h-32 overflow-hidden z-10 flex justify-center items-end rounded-b-[2rem]">
        
        {/* The Pig */}
        <div
          className={`
            absolute bottom-0 transition-transform duration-150 ease-out cursor-pointer select-none
            ${isVisible ? 'translate-y-2' : 'translate-y-full'}
            ${isHit ? 'translate-y-2' : ''}
            ${isHit ? 'animate-shake' : ''}
          `}
          onClick={(e) => {
            e.stopPropagation();
            if (isVisible && !isHit) {
              onHit(mole.id);
            }
          }}
        >
          {/* Pig Sprite/Emoji */}
          <div className="text-[4rem] sm:text-[5rem] leading-none filter drop-shadow-xl relative transform transition-transform hover:scale-105 active:scale-95">
            {isHit ? '🐷' : '🐷'}
            
            {/* Comic "POW" Effect */}
            {showPow && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                 <div className="relative">
                   <span className="absolute text-6xl opacity-90 animate-ping">💥</span>
                   <span className="relative text-red-600 font-black text-2xl rotate-12 drop-shadow-md stroke-white" style={{WebkitTextStroke: '1px white'}}>POW!</span>
                 </div>
               </div>
            )}

            {/* Dizzy Overlay */}
            {isHit && (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                <span className="absolute -top-4 text-3xl animate-stars">⭐</span>
                <span className="absolute -top-2 -right-2 text-2xl animate-stars" style={{ animationDelay: '0.1s' }}>💫</span>
                <span className="absolute -top-2 -left-2 text-2xl animate-stars" style={{ animationDelay: '0.2s' }}>⭐</span>
                <div className="absolute inset-0 flex items-center justify-center text-[4rem] sm:text-[5rem] opacity-90">
                   😵
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dirt/Grass Overlay for depth (bottom lip) */}
      <div className="absolute -bottom-2 w-[110%] h-4 bg-green-700 rounded-[50%] opacity-50 blur-sm z-20 pointer-events-none"></div>
    </div>
  );
};

export default Hole;