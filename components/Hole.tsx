
import React, { useState, useEffect } from 'react';
import { Mole, MoleState } from '../types';

interface HoleProps {
  mole: Mole;
  onHit: (id: number, type: Mole['type']) => void;
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

  const handleHit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Allow hitting slightly before fully visible (RISING) for better feel
    if ((isVisible || mole.state === MoleState.RISING) && !isHit) {
      onHit(mole.id, mole.type);
    }
  };

  // Determine appearance based on Type
  const getEmoji = () => {
    if (mole.type === 'GOLD') return isHit ? '😵' : '👑';
    if (mole.type === 'BOMB') return isHit ? '💥' : '🐂';
    return isHit ? '🐷' : '🐷';
  };
  
  // Render different hit text/effects
  const renderHitEffect = () => {
      if (mole.type === 'BOMB') {
          return (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none w-max">
                 <div className="relative flex justify-center items-center">
                   <span className="absolute text-8xl opacity-90 animate-ping">💢</span>
                   <span className="relative text-black font-black text-4xl -rotate-12 drop-shadow-md stroke-white select-none bg-red-500 text-white px-2 rounded">OUCH!</span>
                 </div>
             </div>
          );
      }
      return (
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none w-max">
            <div className="relative flex justify-center items-center">
                <span className="absolute text-7xl opacity-90 animate-ping">💥</span>
                <span className={`relative font-black text-3xl rotate-12 drop-shadow-md stroke-white select-none ${mole.type === 'GOLD' ? 'text-yellow-500' : 'text-red-600'}`} style={{WebkitTextStroke: '1px white'}}>
                    {mole.type === 'GOLD' ? '+50!' : 'POW!'}
                </span>
            </div>
         </div>
      );
  };

  return (
    <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex justify-center items-end mx-auto">
      {/* The Hole Graphic */}
      <div className="absolute bottom-0 w-full h-12 bg-neutral-800 rounded-[100%] border-b-4 border-neutral-700 shadow-inner z-0"></div>
      
      {/* Masking container */}
      <div className="relative w-full h-32 overflow-hidden z-10 flex justify-center items-end rounded-b-[2rem] pointer-events-none">
        
        {/* The Mole Container */}
        <div
          className={`
            absolute bottom-0 left-1/2 -translate-x-1/2
            transition-transform duration-150 ease-out 
            pointer-events-auto cursor-pointer
            flex justify-center items-center
            ${isVisible ? 'translate-y-2' : 'translate-y-full'}
            ${isHit ? 'translate-y-2 animate-shake' : ''}
          `}
          onClick={handleHit}
        >
          {/* Invisible Hit Box */}
          <div className="absolute w-[140%] h-[140%] -top-[20%] -left-[20%] z-20 bg-transparent rounded-full"></div>

          {/* Sprite/Emoji */}
          <div className="text-[4rem] sm:text-[5rem] leading-none filter drop-shadow-xl relative transform transition-transform hover:scale-105 active:scale-95 z-10">
            {getEmoji()}
            
            {showPow && renderHitEffect()}

            {/* Dizzy Overlay for Normal/Gold Pigs */}
            {isHit && mole.type !== 'BOMB' && (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none">
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
