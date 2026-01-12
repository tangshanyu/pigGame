
import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../services/soundService';

interface FlyingCalfGameProps {
  onBack: () => void;
}

interface Obstacle {
  id: number;
  x: number;       // Percentage (100 to -width)
  gapTop: number;  // Percentage from top
  passed: boolean; // Score counted?
}

// Game Constants - Adjusted for "Slower & Easier" mobile experience
const GRAVITY = 0.12;       // Very low gravity for floaty feel
const JUMP_STRENGTH = -2.2; // Gentle jump
const OBSTACLE_SPEED = 0.35; // Slower horizontal speed
const OBSTACLE_WIDTH = 15;  
const OBSTACLE_GAP = 35;    // Wider gap for easier passage
const CALF_SIZE = 8;        
const CALF_X = 10;          

const FlyingCalfGame: React.FC<FlyingCalfGameProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [calfY, setCalfY] = useState(50); // % from top
  const [calfRotation, setCalfRotation] = useState(0);
  
  // Refs for loop logic (mutable state)
  const calfYRef = useRef(50);
  const velocityRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const lastSpawnTimeRef = useRef(0);
  const scoreRef = useRef(0);

  // Initialize High Score
  useEffect(() => {
    const saved = localStorage.getItem('flyingCalfHighScore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  const startGame = () => {
    // Reset Data
    setScore(0);
    scoreRef.current = 0;
    setCalfY(50);
    calfYRef.current = 50;
    
    // Auto-jump on start
    velocityRef.current = JUMP_STRENGTH; 
    playSound('JUMP');
    
    obstaclesRef.current = [];
    lastSpawnTimeRef.current = Date.now();
    
    // Trigger Play State
    setGameState('PLAYING');
  };

  const jump = () => {
    if (gameState !== 'PLAYING') return;
    velocityRef.current = JUMP_STRENGTH;
    playSound('JUMP');
  };

  // Handle Input (Mouse/Touch)
  const handleInput = (e: React.MouseEvent | React.TouchEvent) => {
    // 1. Allow button interactions to pass through normally
    if ((e.target as HTMLElement).closest('button')) {
        return;
    }

    // 2. Prevent default browser behavior (scrolling, zooming) for gameplay touches
    // Using a type guard to access preventDefault which exists on both, 
    // but specifically targeting touchstart to stop 'pull to refresh' etc.
    if (e.type === 'touchstart') {
        // e.preventDefault(); // Note: React synthetic events might trigger warnings if passive.
        // We rely on CSS touch-action: none mostly, but stopping propagation helps too.
    }

    if (gameState === 'IDLE') {
       startGame();
    } else if (gameState === 'PLAYING') {
       jump();
    }
  };

  const gameOver = () => {
    setGameState('GAME_OVER');
    playSound('CRASH');
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
      localStorage.setItem('flyingCalfHighScore', scoreRef.current.toString());
    }
  };

  // Game Loop managed by Effect
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let animationFrameId: number;
    let lastTime = Date.now();

    const loop = () => {
      const now = Date.now();
      lastTime = now;

      // 1. Physics
      velocityRef.current += GRAVITY;
      calfYRef.current += velocityRef.current;

      // Floor/Ceiling collision
      if (calfYRef.current > 100 - CALF_SIZE || calfYRef.current < 0) {
        gameOver();
        return; // Stop loop
      }

      // 2. Obstacles Management
      // Move existing
      obstaclesRef.current.forEach(obs => {
          obs.x -= OBSTACLE_SPEED;
      });

      // Remove off-screen
      obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x > -OBSTACLE_WIDTH);

      // Spawn new
      // Slower spawn rate to match slower speed (approx every 2.5s)
      if (now - lastSpawnTimeRef.current > 2500) { 
          const minGapY = 10;
          const maxGapY = 90 - OBSTACLE_GAP;
          const gapTop = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
          
          obstaclesRef.current.push({
              id: now,
              x: 100,
              gapTop: gapTop,
              passed: false
          });
          lastSpawnTimeRef.current = now;
      }

      // 3. Collision Detection
      const calfRect = {
          l: CALF_X + 2,
          r: CALF_X + CALF_SIZE - 2,
          t: calfYRef.current + 2,
          b: calfYRef.current + CALF_SIZE - 2
      };

      let crashed = false;

      obstaclesRef.current.forEach(obs => {
          const obsLeft = obs.x;
          const obsRight = obs.x + OBSTACLE_WIDTH;

          // Check horizontal overlap
          if (calfRect.r > obsLeft && calfRect.l < obsRight) {
              // Check vertical overlap
              if (calfRect.t < obs.gapTop || calfRect.b > (obs.gapTop + OBSTACLE_GAP)) {
                  crashed = true;
              }
          }

          // Score
          if (!obs.passed && calfRect.l > obsRight) {
              obs.passed = true;
              scoreRef.current += 1;
              setScore(scoreRef.current);
              playSound('GOLD_HIT');
          }
      });

      if (crashed) {
          gameOver();
          return;
      }

      // 4. Update UI State
      setCalfY(calfYRef.current);
      // Rotation limits
      const rot = Math.min(Math.max(velocityRef.current * 5, -20), 30);
      setCalfRotation(rot);

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  return (
    <div 
        className="fixed inset-0 w-full h-[100dvh] bg-sky-300 overflow-hidden font-sans select-none touch-none overscroll-none"
        onMouseDown={handleInput}
        onTouchStart={handleInput}
        style={{ overscrollBehavior: 'none' }} // Ensure no bounce effect
    >
        {/* Background Clouds/Scenery */}
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-0 w-full h-1/4 bg-green-500 border-t-8 border-green-700"></div>
            <div className="absolute top-20 left-10 text-6xl opacity-50 animate-pulse">☁️</div>
            <div className="absolute top-40 right-20 text-8xl opacity-40">☁️</div>
            
            {/* Moving Ground Decor */}
            <div className="absolute bottom-4 left-10 text-4xl opacity-80">🌻</div>
            <div className="absolute bottom-8 right-1/4 text-4xl opacity-80">🌾</div>
        </div>

        {/* Game Container */}
        <div className="relative w-full h-full max-w-2xl mx-auto border-x-4 border-black/10 bg-sky-200/20 backdrop-blur-[1px]">
            
            {/* Header / Score */}
            <div className="absolute top-12 sm:top-10 w-full text-center z-20 pointer-events-none">
                <span className="text-6xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.3)] stroke-black" style={{WebkitTextStroke: '2px black'}}>
                    {score}
                </span>
                {gameState === 'IDLE' && <div className="block mt-2"><div className="text-white font-bold bg-black/30 px-4 py-1 rounded-full inline-block">High Score: {highScore}</div></div>}
            </div>

            {/* Back Button */}
            <div className="absolute top-6 left-6 z-50">
                <button 
                    onClick={(e) => { e.stopPropagation(); onBack(); }}
                    className="bg-white/80 p-3 rounded-full hover:bg-white transition shadow-lg border-2 border-amber-800 active:scale-90"
                    style={{ touchAction: 'manipulation' }}
                >
                ⬅️ 離開
                </button>
            </div>

            {/* Obstacles */}
            {obstaclesRef.current.map(obs => (
                <div key={obs.id} className="absolute h-full pointer-events-none" style={{ left: `${obs.x}%`, width: `${OBSTACLE_WIDTH}%` }}>
                    {/* Top Fence */}
                    <div 
                        className="absolute top-0 w-full bg-amber-700 border-x-4 border-amber-900 flex flex-col items-center justify-end overflow-hidden"
                        style={{ height: `${obs.gapTop}%` }}
                    >
                        <div className="w-full h-4 bg-amber-900 mb-2"></div>
                        <div className="w-full h-4 bg-amber-900 mb-2"></div>
                        <div className="absolute bottom-[-10px] text-4xl">🐷</div>
                    </div>

                    {/* Bottom Fence */}
                    <div 
                        className="absolute bottom-0 w-full bg-amber-700 border-x-4 border-amber-900 flex flex-col items-center justify-start overflow-hidden"
                        style={{ height: `${100 - obs.gapTop - OBSTACLE_GAP}%` }}
                    >
                         <div className="w-full h-4 bg-amber-900 mt-2"></div>
                         <div className="w-full h-4 bg-amber-900 mt-2"></div>
                         <div className="absolute top-[-10px] text-4xl">🐷</div>
                    </div>
                </div>
            ))}

            {/* The Calf */}
            <div 
                className="absolute z-10 flex justify-center items-center pointer-events-none transition-transform duration-100 ease-linear"
                style={{ 
                    left: `${CALF_X}%`, 
                    top: `${calfY}%`, 
                    width: `${CALF_SIZE}%`, 
                    height: `${CALF_SIZE}%`,
                    transform: `rotate(${calfRotation}deg)`
                }}
            >
                <div className="relative text-[3.5rem] leading-none filter drop-shadow-lg">
                    {/* Cow Body */}
                    🐮
                    {/* Wings */}
                    <div className="absolute top-2 -left-2 text-4xl animate-pulse origin-bottom-right" style={{ animationDuration: '0.2s' }}>🪽</div>
                    
                    {/* Goggles */}
                    <div className="absolute top-2 left-0 text-3xl opacity-90">🥽</div>
                    
                    {/* Speed Lines effect when falling fast */}
                    {velocityRef.current > 1.5 && (
                       <div className="absolute -top-10 left-1 text-2xl rotate-90 opacity-50">💨</div>
                    )}
                </div>
            </div>

            {/* Start / Game Over Screens */}
            {gameState === 'IDLE' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-30 pointer-events-none">
                    <div className="text-center animate-bounce">
                        <div className="text-8xl mb-4 transform -rotate-12">🐮🪽</div>
                        <h2 className="text-3xl font-black text-white stroke-black drop-shadow-lg">點擊開始飛行</h2>
                    </div>
                </div>
            )}

            {gameState === 'GAME_OVER' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-30">
                     <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl text-center border-8 border-red-400 animate-pop-in max-w-sm w-[90%]">
                        <div className="text-6xl mb-2">💥</div>
                        <h2 className="text-4xl font-black text-red-600 mb-4">撞到了!</h2>
                        <div className="mb-6">
                            <p className="text-gray-500 font-bold uppercase text-xs">Score</p>
                            <p className="text-6xl font-black text-amber-600">{score}</p>
                            {score >= highScore && score > 0 && <p className="text-green-500 font-bold mt-1">✨ 新紀錄! ✨</p>}
                        </div>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                startGame(); 
                            }}
                            className="bg-green-500 hover:bg-green-600 text-white text-xl font-black py-3 px-8 rounded-full shadow-lg transform transition active:scale-95 border-b-4 border-green-700 w-full"
                            style={{ touchAction: 'manipulation' }}
                        >
                            再試一次 🔄
                        </button>
                     </div>
                </div>
            )}

        </div>
    </div>
  );
};

export default FlyingCalfGame;
