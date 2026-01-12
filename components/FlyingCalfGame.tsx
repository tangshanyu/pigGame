
import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../services/soundService';

interface FlyingCalfGameProps {
  onBack: () => void;
}

type ItemType = 'MILK' | 'MEAT';

interface Item {
    type: ItemType;
    yOffset: number; // Offset from the center of the gap
    collected: boolean;
}

interface Obstacle {
  id: number;
  x: number;       // Percentage (100 to -width)
  gapTop: number;  // Percentage from top
  gapHeight: number; // Dynamic gap height
  passed: boolean; // Score counted?
  item?: Item;     // Optional item in this obstacle gap
  smashed?: boolean; // If smashed in rush mode
}

// Game Constants
// Physics
const GRAVITY = 0.08;       
const JUMP_STRENGTH = -1.2; 

// Difficulty Scaling Constants
const INITIAL_SPEED = 0.35;
const MAX_SPEED = 0.80;     // Cap speed so it's not impossible
const SPEED_INC_PER_SCORE = 0.005; // Speed increase per point
const RUSH_SPEED_MULTIPLIER = 2.5; // How much faster to go during rush

const INITIAL_GAP = 35;
const MIN_GAP = 18;         // Minimum gap size (very tight)
const GAP_DEC_PER_SCORE = 0.2; // Gap decrease per point

const OBSTACLE_WIDTH = 15;  
const SPAWN_DISTANCE = 45;  // Distance between pipes in % (lower = closer together)
const CALF_SIZE = 8;        
const CALF_X_NORMAL = 10;
const CALF_X_RUSH = 30;     // Move forward during rush

const FlyingCalfGame: React.FC<FlyingCalfGameProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [calfY, setCalfY] = useState(50); // % from top
  const [calfRotation, setCalfRotation] = useState(0);
  
  // Power Up State
  const [isRushMode, setIsRushMode] = useState(false);
  
  // Refs for loop logic (mutable state)
  const calfYRef = useRef(50);
  const velocityRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const scoreRef = useRef(0);
  const rushTimerRef = useRef<number | null>(null);
  const isRushModeRef = useRef(false);
  
  // Current Difficulty Refs (calculated each frame)
  const currentSpeedRef = useRef(INITIAL_SPEED);
  const currentGapRef = useRef(INITIAL_GAP);
  
  // Ref to prevent ghost clicks (double firing on mobile)
  const lastTouchTimeRef = useRef(0);

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
    setIsRushMode(false);
    isRushModeRef.current = false;
    
    // Reset difficulty
    currentSpeedRef.current = INITIAL_SPEED;
    currentGapRef.current = INITIAL_GAP;
    
    // Auto-jump on start
    velocityRef.current = JUMP_STRENGTH; 
    playSound('JUMP');
    
    obstaclesRef.current = [];
    
    // Trigger Play State
    setGameState('PLAYING');
  };

  const jump = () => {
    if (gameState !== 'PLAYING') return;
    velocityRef.current = JUMP_STRENGTH;
    playSound('JUMP');
  };

  const activateRushMode = () => {
      if (rushTimerRef.current) clearTimeout(rushTimerRef.current);
      
      setIsRushMode(true);
      isRushModeRef.current = true;
      playSound('POWER_UP');
      
      rushTimerRef.current = window.setTimeout(() => {
          setIsRushMode(false);
          isRushModeRef.current = false;
      }, 3000); // 3 Seconds
  };

  // Handle Input (Mouse/Touch)
  const handleInput = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
        return;
    }

    const now = Date.now();
    if (e.type === 'touchstart') {
        lastTouchTimeRef.current = now;
    } else if (e.type === 'mousedown') {
        if (now - lastTouchTimeRef.current < 800) {
            return;
        }
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
    if (rushTimerRef.current) clearTimeout(rushTimerRef.current);
    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
      localStorage.setItem('flyingCalfHighScore', scoreRef.current.toString());
    }
  };

  // Game Loop managed by Effect
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let animationFrameId: number;

    const loop = () => {
      const now = Date.now();

      // 0. Calculate Difficulty based on Score
      // Speed increases linearily, capped at MAX_SPEED
      let baseSpeed = Math.min(MAX_SPEED, INITIAL_SPEED + (scoreRef.current * SPEED_INC_PER_SCORE));
      
      // Apply Rush Mode Speed Multiplier
      if (isRushModeRef.current) {
          baseSpeed *= RUSH_SPEED_MULTIPLIER;
      }
      
      currentSpeedRef.current = baseSpeed;
      
      // Gap decreases linearily, capped at MIN_GAP
      currentGapRef.current = Math.max(MIN_GAP, INITIAL_GAP - (scoreRef.current * GAP_DEC_PER_SCORE));

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
          obs.x -= currentSpeedRef.current;
      });

      // Remove off-screen
      obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x > -OBSTACLE_WIDTH);

      // Spawn new (Distance based spawning)
      const lastObs = obstaclesRef.current[obstaclesRef.current.length - 1];
      // If no obstacles OR the last one has moved far enough left to make room
      if (!lastObs || lastObs.x < (100 - SPAWN_DISTANCE)) { 
          
          const gapH = currentGapRef.current;
          const minGapY = 10;
          const maxGapY = 90 - gapH;
          const gapTop = Math.floor(Math.random() * (maxGapY - minGapY + 1)) + minGapY;
          
          // Determine Item
          let item: Item | undefined;
          const rand = Math.random();
          if (rand < 0.4) { // 40% chance for Milk
              item = { type: 'MILK', yOffset: gapH / 2, collected: false };
          } else if (rand > 0.92) { // 8% chance for Meat (Rare)
              item = { type: 'MEAT', yOffset: gapH / 2, collected: false };
          }

          obstaclesRef.current.push({
              id: now,
              x: 100,
              gapTop: gapTop,
              gapHeight: gapH,
              passed: false,
              item,
              smashed: false
          });
      }

      // 3. Collision Detection
      // Determine effective Calf X for collision (approximated, visual X changes but hitbox stays mostly reliable)
      // To keep it fair, we use the VISUAL X position for collision logic too, so if you dash forward, you hit things sooner.
      const currentCalfX = isRushModeRef.current ? CALF_X_RUSH : CALF_X_NORMAL;

      const calfRect = {
          l: currentCalfX + 2,
          r: currentCalfX + CALF_SIZE - 2,
          t: calfYRef.current + 2,
          b: calfYRef.current + CALF_SIZE - 2,
          centerX: currentCalfX + CALF_SIZE/2,
          centerY: calfYRef.current + CALF_SIZE/2
      };

      let crashed = false;

      obstaclesRef.current.forEach(obs => {
          const obsLeft = obs.x;
          const obsRight = obs.x + OBSTACLE_WIDTH;

          // -- Item Collision --
          if (obs.item && !obs.item.collected) {
              const itemX = obs.x + (OBSTACLE_WIDTH / 2);
              const itemY = obs.gapTop + obs.item.yOffset;
              
              const dx = Math.abs(calfRect.centerX - itemX);
              const dy = Math.abs(calfRect.centerY - itemY);
              
              if (dx < 6 && dy < 6) { // slightly generous hit box
                  obs.item.collected = true;
                  if (obs.item.type === 'MILK') {
                      scoreRef.current += 5;
                      setScore(scoreRef.current);
                      playSound('EAT');
                  } else if (obs.item.type === 'MEAT') {
                      activateRushMode();
                  }
              }
          }

          // -- Obstacle Collision --
          if (calfRect.r > obsLeft && calfRect.l < obsRight) {
              if (!obs.smashed && (calfRect.t < obs.gapTop || calfRect.b > (obs.gapTop + obs.gapHeight))) {
                  if (isRushModeRef.current) {
                      obs.smashed = true;
                      playSound('SMASH');
                      scoreRef.current += 2; 
                      setScore(scoreRef.current);
                  } else {
                      crashed = true;
                  }
              }
          }

          // Score for passing
          if (!obs.passed && calfRect.l > obsRight) {
              obs.passed = true;
              scoreRef.current += 1;
              setScore(scoreRef.current);
              if (!isRushModeRef.current) playSound('GOLD_HIT');
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
        className={`fixed inset-0 w-full h-[100dvh] overflow-hidden font-sans select-none touch-none overscroll-none transition-colors duration-500 ${isRushMode ? 'bg-orange-400' : 'bg-sky-300'}`}
        onMouseDown={handleInput}
        onTouchStart={handleInput}
        style={{ overscrollBehavior: 'none' }}
    >
        {/* Background Clouds/Scenery */}
        <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute bottom-0 w-full h-1/4 border-t-8 transition-colors duration-500 ${isRushMode ? 'bg-orange-700 border-orange-900' : 'bg-green-500 border-green-700'}`}></div>
            
            {/* Scenery moves faster in rush mode (visual trick by changing animation duration if we were using CSS anims, but here they are static for now) */}
            <div className="absolute top-20 left-10 text-6xl opacity-50 animate-pulse">☁️</div>
            <div className="absolute top-40 right-20 text-8xl opacity-40">☁️</div>
            
            {/* Speed Lines Overlay */}
            {isRushMode && (
                <div className="absolute inset-0 z-0 overflow-hidden">
                    {/* Horizontal speed lines */}
                    <div className="absolute top-[20%] -right-10 w-full h-1 bg-white opacity-50 animate-[ping_0.5s_linear_infinite]"></div>
                    <div className="absolute top-[40%] -right-20 w-full h-1 bg-white opacity-60 animate-[ping_0.4s_linear_infinite]"></div>
                    <div className="absolute top-[60%] -right-10 w-full h-2 bg-white opacity-40 animate-[ping_0.3s_linear_infinite]"></div>
                    <div className="absolute top-[80%] -right-30 w-full h-1 bg-white opacity-70 animate-[ping_0.6s_linear_infinite]"></div>
                    
                    {/* Radial blur effect simulation */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent mix-blend-overlay"></div>
                </div>
            )}
            
            {/* Moving Ground Decor */}
            <div className="absolute bottom-4 left-10 text-4xl opacity-80">🌻</div>
            <div className="absolute bottom-8 right-1/4 text-4xl opacity-80">🌾</div>
        </div>

        {/* Game Container */}
        <div className="relative w-full h-full max-w-2xl mx-auto border-x-4 border-black/10 bg-sky-200/20 backdrop-blur-[1px]">
            
            {/* Header / Score */}
            <div className="absolute top-12 sm:top-10 w-full text-center z-20 pointer-events-none">
                <span className={`text-6xl font-black drop-shadow-[0_4px_0_rgba(0,0,0,0.3)] stroke-black transition-colors ${isRushMode ? 'text-yellow-300 scale-110' : 'text-white'}`} style={{WebkitTextStroke: '2px black'}}>
                    {score}
                </span>
                {gameState === 'IDLE' && <div className="block mt-2"><div className="text-white font-bold bg-black/30 px-4 py-1 rounded-full inline-block">High Score: {highScore}</div></div>}
                
                {/* Rush Mode Indicator */}
                {isRushMode && <div className="text-white font-black text-3xl animate-bounce mt-2 uppercase tracking-wider drop-shadow-md stroke-red-600" style={{WebkitTextStroke: '1px red'}}>暴衝中!!!</div>}
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
                        className={`absolute top-0 w-full border-x-4 flex flex-col items-center justify-end overflow-hidden transition-all duration-75 ${obs.smashed ? 'opacity-0 scale-y-0' : 'opacity-100'} ${isRushMode ? 'bg-red-700 border-red-900' : 'bg-amber-700 border-amber-900'}`}
                        style={{ height: `${obs.gapTop}%` }}
                    >
                        <div className={`w-full h-4 mb-2 ${isRushMode ? 'bg-red-900' : 'bg-amber-900'}`}></div>
                        <div className={`w-full h-4 mb-2 ${isRushMode ? 'bg-red-900' : 'bg-amber-900'}`}></div>
                        <div className="absolute bottom-[-10px] text-4xl">🐷</div>
                    </div>

                    {/* Item Rendering */}
                    {obs.item && !obs.item.collected && (
                        <div 
                            className="absolute left-1/2 -translate-x-1/2 z-10 animate-bounce"
                            style={{ top: `${obs.gapTop + obs.item.yOffset}%`, transform: 'translate(-50%, -50%)' }}
                        >
                            <span className={`text-4xl drop-shadow-md ${obs.item.type === 'MEAT' ? 'animate-pulse scale-125' : ''}`}>
                                {obs.item.type === 'MILK' ? '🍼' : '🍖'}
                            </span>
                        </div>
                    )}

                    {/* Bottom Fence */}
                    <div 
                        className={`absolute bottom-0 w-full border-x-4 flex flex-col items-center justify-start overflow-hidden transition-all duration-75 ${obs.smashed ? 'opacity-0 scale-y-0' : 'opacity-100'} ${isRushMode ? 'bg-red-700 border-red-900' : 'bg-amber-700 border-amber-900'}`}
                        style={{ height: `${100 - obs.gapTop - obs.gapHeight}%` }}
                    >
                         <div className={`w-full h-4 mt-2 ${isRushMode ? 'bg-red-900' : 'bg-amber-900'}`}></div>
                         <div className={`w-full h-4 mt-2 ${isRushMode ? 'bg-red-900' : 'bg-amber-900'}`}></div>
                         <div className="absolute top-[-10px] text-4xl">🐷</div>
                    </div>
                </div>
            ))}

            {/* The Calf */}
            <div 
                className="absolute z-10 flex justify-center items-center pointer-events-none ease-linear"
                style={{ 
                    left: `${isRushMode ? CALF_X_RUSH : CALF_X_NORMAL}%`, 
                    top: `${calfY}%`, 
                    width: `${CALF_SIZE}%`, 
                    height: `${CALF_SIZE}%`,
                    transform: `rotate(${calfRotation}deg)`,
                    transition: 'left 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
                }}
            >
                <div className={`relative text-[3.5rem] leading-none filter drop-shadow-lg ${isRushMode ? 'animate-pulse' : ''}`}>
                    {/* Horizontal Cow Body (Flipped to face right) */}
                    <div className="transform scale-x-[-1]">
                        {isRushMode ? '🐃' : '🐄'}
                    </div>
                    
                    {/* Wings - Adjusted for horizontal body */}
                    <div className="absolute -top-3 left-3 text-4xl animate-pulse origin-bottom-right" style={{ animationDuration: '0.2s' }}>
                        {isRushMode ? '🔥' : '🪽'}
                    </div>
                    
                    {/* Speed Lines effect when falling fast OR Rushing */}
                    {(velocityRef.current > 1.5 || isRushMode) && (
                       <div className="absolute -top-10 -left-6 text-4xl rotate-90 opacity-70">💨</div>
                    )}
                </div>
            </div>

            {/* Start / Game Over Screens */}
            {gameState === 'IDLE' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-30 pointer-events-none">
                    <div className="text-center animate-bounce">
                        <div className="text-8xl mb-4 transform scale-x-[-1]">🐄🪽</div>
                        <h2 className="text-3xl font-black text-white stroke-black drop-shadow-lg">點擊開始飛行</h2>
                        <div className="mt-4 flex justify-center gap-4 text-white font-bold bg-black/40 p-2 rounded-xl text-sm">
                            <span>🍼 +5分</span>
                            <span>🍖 暴衝模式</span>
                        </div>
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
