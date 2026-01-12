
import React, { useState, useEffect, useRef } from 'react';
import { playSound } from '../services/soundService';

interface MilkingGameProps {
  onBack: () => void;
}

interface Udder {
  id: number;
  fullness: number; // 0 to 100
  fillRate: number; // How fast it fills
  isSqueezing: boolean;
  hasFly: boolean;  // Pest mechanic
  isGold: boolean;  // Bonus mechanic
}

interface ShippedCrate {
    id: number;
    timestamp: number;
}

const MAX_ANGER = 100;
const BOTTLE_CAPACITY = 100;
const BOTTLES_PER_CRATE = 6;
const GAME_DURATION = 60;

const MilkingGame: React.FC<MilkingGameProps> = ({ onBack }) => {
  const [gameState, setGameState] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER'>('IDLE');
  const [score, setScore] = useState(0); // Crates shipped
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [anger, setAnger] = useState(0);
  const [bottleFill, setBottleFill] = useState(0);
  
  // New States for Manual Crate Management
  const [bottlesInCrate, setBottlesInCrate] = useState(0);
  const [hasActiveCrate, setHasActiveCrate] = useState(true);
  const [crateIsPacked, setCrateIsPacked] = useState(false); // Ready to ship

  const [shippedCrates, setShippedCrates] = useState<ShippedCrate[]>([]);
  
  // Game State Refs
  const uddersRef = useRef<Udder[]>([
    { id: 0, fullness: 20, fillRate: 0.3, isSqueezing: false, hasFly: false, isGold: false },
    { id: 1, fullness: 50, fillRate: 0.4, isSqueezing: false, hasFly: false, isGold: false },
    { id: 2, fullness: 10, fillRate: 0.2, isSqueezing: false, hasFly: false, isGold: false },
    { id: 3, fullness: 80, fillRate: 0.5, isSqueezing: false, hasFly: false, isGold: false },
  ]);
  const angerRef = useRef(0);
  const bottleRef = useRef(0);
  const bottlesInCrateRef = useRef(0); // Ref for sync loop
  const shippedRef = useRef<ShippedCrate[]>([]);
  
  // Force re-render for animation loop
  const [, setTick] = useState(0);
  const reqRef = useRef<number>(0);

  const startGame = () => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setAnger(0);
    setBottleFill(0);
    
    // Reset Crate Logic
    setBottlesInCrate(0);
    setHasActiveCrate(true);
    setCrateIsPacked(false);
    bottlesInCrateRef.current = 0;

    setShippedCrates([]);
    angerRef.current = 0;
    bottleRef.current = 0;
    shippedRef.current = [];
    
    // Randomize initial stats
    uddersRef.current = uddersRef.current.map((u, i) => ({
        ...u,
        fullness: Math.random() * 50,
        fillRate: 0.2 + (Math.random() * 0.4),
        isSqueezing: false,
        hasFly: false,
        isGold: false
    }));

    setGameState('PLAYING');
  };

  const handleSqueezeStart = (id: number) => {
    if (gameState !== 'PLAYING') return;
    const udder = uddersRef.current[id];
    
    // Fly Check
    if (udder.hasFly) {
        angerRef.current = Math.min(MAX_ANGER, angerRef.current + 15);
        setAnger(angerRef.current);
        playSound('BUZZ');
        return;
    }

    udder.isSqueezing = true;
    
    // Punishment for squeezing empty udder
    if (udder.fullness < 5) {
        angerRef.current = Math.min(MAX_ANGER, angerRef.current + 8);
        setAnger(angerRef.current);
        playSound('MOO'); 
    }
  };

  const handleSqueezeEnd = (id: number) => {
     uddersRef.current[id].isSqueezing = false;
  };
  
  const handleSwat = (e: React.MouseEvent | React.TouchEvent, id: number) => {
      e.stopPropagation(); 
      const udder = uddersRef.current[id];
      if (udder.hasFly) {
          udder.hasFly = false;
          playSound('SPLAT');
          setTick(prev => prev + 1); 
      }
  };

  // Step 1: Pack Bottle into Crate
  const packBottle = () => {
      if (gameState !== 'PLAYING') return;
      if (!hasActiveCrate || crateIsPacked) return; // No crate or crate full
      
      if (bottleRef.current >= BOTTLE_CAPACITY) {
          // Add to Crate
          bottlesInCrateRef.current += 1;
          setBottlesInCrate(bottlesInCrateRef.current);
          
          // Reset Bottle
          bottleRef.current = 0;
          setBottleFill(0);
          
          playSound('RHYTHM_HIT'); 

          // Check if Crate is Full
          if (bottlesInCrateRef.current >= BOTTLES_PER_CRATE) {
              setCrateIsPacked(true);
              playSound('BOSS_HIT'); // Packing sound (Heavy thud)
          }
      } else {
          playSound('RHYTHM_MISS');
      }
  };

  // Step 2: Manually Ship the Full Crate
  const pushCrateToConveyor = () => {
      if (gameState !== 'PLAYING' || !crateIsPacked) return;

      setScore(s => s + 1);
      
      // Visual Conveyor
      const newCrate = { id: Date.now(), timestamp: Date.now() };
      shippedRef.current.push(newCrate);
      setShippedCrates([...shippedRef.current]);

      // Remove active crate from station
      setHasActiveCrate(false);
      setCrateIsPacked(false);
      bottlesInCrateRef.current = 0;
      setBottlesInCrate(0);

      playSound('CONVEYOR'); // Heavy mechanical sound
      
      // Rewards
      angerRef.current = Math.max(0, angerRef.current - 20); 
      uddersRef.current.forEach(u => u.fillRate += 0.05); 
  };

  // Step 3: Get New Crate
  const getNewCrate = () => {
      if (gameState !== 'PLAYING' || hasActiveCrate) return;
      
      setHasActiveCrate(true);
      playSound('SMASH'); // Wood sound
  };

  // Game Loop
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    let lastTime = Date.now();

    const loop = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 16.66; // Normalize to ~60fps
      lastTime = now;

      // 1. Update Udders
      uddersRef.current.forEach(u => {
          const flyChance = 0.001 + (score * 0.0005); 
          if (!u.hasFly && !u.isSqueezing && Math.random() < flyChance) {
              u.hasFly = true;
              playSound('BUZZ');
          }

          if (u.isSqueezing) {
              if (u.fullness > 0 && bottleRef.current < BOTTLE_CAPACITY) {
                  const speedMult = u.isGold ? 3.0 : 1.0;
                  const drainAmount = 2.0 * dt * speedMult;
                  
                  u.fullness = Math.max(0, u.fullness - drainAmount);
                  bottleRef.current = Math.min(BOTTLE_CAPACITY, bottleRef.current + drainAmount);
                  
                  if (u.isGold) {
                      angerRef.current = Math.max(0, angerRef.current - (0.05 * dt));
                  }
                  
              } else if (u.fullness <= 0) {
                  u.isGold = false; 
                  angerRef.current = Math.min(MAX_ANGER, angerRef.current + (0.5 * dt));
              }
          } else {
              u.fullness = Math.min(100, u.fullness + (u.fillRate * dt));
              
              if (!u.isGold && !u.hasFly && Math.random() < 0.002) {
                  u.isGold = true;
              }
              if (u.fullness >= 100) {
                  u.isGold = false;
                  angerRef.current = Math.min(MAX_ANGER, angerRef.current + (0.1 * dt));
              }
          }
      });

      // 2. Natural Anger Decay
      if (angerRef.current > 0) {
          angerRef.current = Math.max(0, angerRef.current - (0.05 * dt));
      }

      // 3. Clean up shipped crates visual
      if (shippedRef.current.length > 0) {
          const nowTime = Date.now();
          const valid = shippedRef.current.filter(b => nowTime - b.timestamp < 3000);
          if (valid.length !== shippedRef.current.length) {
              shippedRef.current = valid;
              setShippedCrates([...valid]);
          }
      }

      // 4. Check Game Over
      if (angerRef.current >= MAX_ANGER) {
          setGameState('GAME_OVER');
          playSound('CRASH');
          return; 
      }

      setAnger(angerRef.current);
      setBottleFill(bottleRef.current);
      setTick(prev => prev + 1); 
      
      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);

    const timerInterval = setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 1) {
                setGameState('GAME_OVER');
                playSound('BOSS_DEFEATED'); 
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => {
        cancelAnimationFrame(reqRef.current);
        clearInterval(timerInterval);
    };
  }, [gameState, score]);

  // Render Helpers
  const getCowFace = () => {
      if (anger > 80) return '🤬';
      if (anger > 50) return '😠';
      if (anger > 20) return '😑';
      return '🐮';
  };

  const getUdderStyles = (u: Udder) => {
      // Visual Logic:
      // Empty = Small, Gray/Pink, No Liquid
      // Full = Large, Bright Pink, White Liquid
      const scale = 0.85 + (u.fullness / 100) * 0.15; // 0.85x to 1.0x size
      
      let containerClass = "border-4 shadow-xl flex flex-col justify-end items-center overflow-hidden relative transition-transform duration-75 ";
      
      if (u.isGold) {
          containerClass += "bg-yellow-200 border-yellow-600 ring-4 ring-yellow-100 shadow-[0_0_15px_gold] ";
      } else {
          // Darker pink border
          containerClass += "bg-pink-200 border-pink-800 ";
      }

      if (u.fullness > 90) containerClass += "animate-pulse ";

      return {
          containerClass,
          style: { transform: `scale(${scale})` },
          liquidClass: u.isGold ? 'bg-yellow-100' : 'bg-white', // Milk is white!
          teatColor: u.isGold ? 'bg-yellow-600' : 'bg-pink-600'
      };
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-orange-50 font-sans select-none touch-none overflow-hidden flex flex-col">
       
       {/* Top Bar */}
       <div className="bg-white/80 backdrop-blur p-4 flex justify-between items-center shadow-md z-20 h-20 shrink-0">
           <div className="flex flex-col w-1/3">
               <span className="text-xs font-bold text-red-600 uppercase">憤怒指數</span>
               <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                   <div 
                     className={`h-full transition-all duration-100 ${anger > 80 ? 'bg-red-600' : 'bg-orange-500'}`} 
                     style={{ width: `${anger}%` }}
                   ></div>
               </div>
           </div>
           
           <div className="text-4xl filter drop-shadow-md transition-transform duration-300" style={{ transform: `scale(${1 + anger/100})` }}>
               {getCowFace()}
           </div>

           <div className="w-1/3 text-right">
               <div className="text-3xl font-black text-amber-800">{timeLeft}s</div>
               <div className="text-sm font-bold text-amber-600">出貨: {score} 箱</div>
           </div>
       </div>

       {/* Back Button */}
       <div className="absolute top-24 left-4 z-50">
           <button onClick={onBack} className="bg-white/50 p-2 rounded-full hover:bg-white border-2 border-amber-800 text-sm">
             ⬅️ 離開
           </button>
       </div>

       {/* Main Game Area */}
       <div className="flex-1 flex flex-col items-center relative overflow-hidden">
           
           {/* Cow Body Decor */}
           <div className="absolute top-[-5%] w-full h-1/3 bg-white border-b-8 border-black rounded-b-[50%] z-0">
               <div className="absolute top-10 left-10 w-20 h-20 bg-black rounded-full opacity-80 transform rotate-12"></div>
               <div className="absolute top-20 right-20 w-32 h-24 bg-black rounded-full opacity-80 transform -rotate-6"></div>
           </div>

           {/* Udders Grid (Top Half) */}
           <div className="relative z-10 grid grid-cols-2 gap-6 sm:gap-12 mt-4 sm:mt-8 mb-4 shrink-0">
               {uddersRef.current.map((u) => {
                   const styles = getUdderStyles(u);
                   return (
                   <button
                       key={u.id}
                       className={`w-24 h-24 sm:w-32 sm:h-32 rounded-b-[3rem] rounded-t-xl ${styles.containerClass} active:scale-90`}
                       style={styles.style}
                       onMouseDown={() => handleSqueezeStart(u.id)}
                       onMouseUp={() => handleSqueezeEnd(u.id)}
                       onMouseLeave={() => handleSqueezeEnd(u.id)}
                       onTouchStart={(e) => { e.preventDefault(); handleSqueezeStart(u.id); }}
                       onTouchEnd={(e) => { e.preventDefault(); handleSqueezeEnd(u.id); }}
                   >
                       {/* Milk Liquid (Fills from bottom) */}
                       <div 
                         className={`absolute bottom-0 w-full transition-all duration-100 ease-linear ${styles.liquidClass}`}
                         style={{ height: `${u.fullness}%` }}
                       ></div>
                       
                       {/* Glassy reflection overlay */}
                       <div className="absolute top-2 right-2 w-4 h-4 bg-white opacity-40 rounded-full"></div>
                       
                       {/* Teat Tip */}
                       <div className={`w-8 h-10 ${styles.teatColor} rounded-b-full mb-[-8px] z-20 shadow-md`}></div>

                       {u.hasFly && (
                           <div 
                             className="absolute inset-0 flex items-center justify-center z-30 animate-pulse bg-black/10 rounded-t-xl rounded-b-full cursor-pointer"
                             onClick={(e) => handleSwat(e, u.id)}
                             onTouchStart={(e) => handleSwat(e, u.id)}
                           >
                               <span className="text-5xl drop-shadow-lg filter">🪰</span>
                           </div>
                       )}

                       {u.isSqueezing && u.fullness > 0 && bottleFill < 100 && !u.hasFly && (
                           <div className="absolute -bottom-10 text-white font-black text-xl animate-bounce drop-shadow-md z-40 bg-blue-500/80 px-2 rounded-full">
                               擠!
                           </div>
                       )}
                   </button>
               )})}
           </div>

           {/* Workstation (Bottom Half) */}
           <div className="w-full max-w-3xl px-2 flex items-end justify-around gap-2 relative z-10 flex-1 pb-32 sm:pb-36">
               
               {/* 1. Current Filling Bottle */}
               <div className="flex flex-col items-center">
                   <div className="text-xs font-bold text-gray-500 mb-1">1. 擠奶</div>
                   <div className="relative w-16 h-28 sm:w-20 sm:h-32 bg-blue-100/30 border-4 border-blue-200 rounded-xl overflow-hidden shadow-inner">
                       <div 
                         className="absolute bottom-0 w-full bg-white transition-all duration-75 ease-linear border-t-4 border-gray-200"
                         style={{ height: `${bottleFill}%` }}
                       ></div>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-blue-900/10 font-black text-lg -rotate-90">MILK</span>
                        </div>
                   </div>
                   {/* Pack Arrow */}
                   <button
                        onClick={packBottle}
                        disabled={bottleFill < 100 || !hasActiveCrate || crateIsPacked}
                        className={`mt-2 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-b-4 active:border-b-0 active:translate-y-1 transition-all ${
                            (bottleFill >= 100 && hasActiveCrate && !crateIsPacked)
                            ? 'bg-green-500 border-green-700 text-white animate-pulse' 
                            : 'bg-gray-300 border-gray-400 text-gray-500'
                        }`}
                    >
                        <span className="text-xl font-black">➡</span>
                    </button>
               </div>

               {/* 2. The Crate Spot (Manual Management) */}
               <div className="flex flex-col items-center justify-end w-40 h-40 relative">
                    <div className="text-xs font-bold text-gray-500 mb-1">2. 裝箱出貨</div>
                    
                    {!hasActiveCrate ? (
                        /* Empty Spot Placeholder */
                        <div className="w-32 h-24 border-4 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-300 font-bold text-sm">
                            空空如也
                        </div>
                    ) : (
                        /* Active Crate */
                        <div 
                            className={`relative w-36 h-28 sm:w-40 sm:h-32 bg-amber-700 border-4 border-amber-900 rounded-lg shadow-xl p-2 flex flex-wrap content-end gap-1 transition-transform ${crateIsPacked ? 'cursor-pointer hover:scale-105 active:scale-95 ring-4 ring-green-400' : ''}`}
                            onClick={pushCrateToConveyor}
                        >
                            {/* Tape Logic when packed */}
                            {crateIsPacked && (
                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/10">
                                    <div className="w-full h-8 bg-yellow-400/80 -rotate-12 absolute border border-yellow-600"></div>
                                    <div className="relative bg-green-600 text-white font-black px-4 py-1 rounded shadow-lg border-2 border-white animate-bounce">
                                        點擊出貨!
                                    </div>
                                </div>
                            )}

                            {/* Crate Label */}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-200 px-2 rounded-sm border border-amber-900 text-[10px] font-black tracking-widest text-amber-900 shadow-sm z-20">
                                {crateIsPacked ? 'READY' : `${bottlesInCrate}/${BOTTLES_PER_CRATE}`}
                            </div>

                            {/* Bottles in Crate */}
                            {Array.from({ length: BOTTLES_PER_CRATE }).map((_, i) => (
                                <div key={i} className="w-[30%] h-[45%] relative flex justify-center items-end">
                                    {i < bottlesInCrate ? (
                                        <div className="w-[80%] h-full bg-white border-2 border-gray-300 rounded-t-md animate-pop-in relative">
                                            <div className="absolute top-1 left-0 w-full h-1 bg-red-500 opacity-20"></div>
                                        </div>
                                    ) : (
                                        <div className="w-[80%] h-[20%] bg-black/20 rounded-full mb-1"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
               </div>

               {/* 3. New Crate Stack */}
               <div className="flex flex-col items-center">
                    <div className="text-xs font-bold text-gray-500 mb-1">3. 拿新箱子</div>
                    <button 
                        onClick={getNewCrate}
                        disabled={hasActiveCrate}
                        className={`w-20 h-24 bg-amber-800 border-4 border-amber-950 rounded-lg shadow-[4px_4px_0px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center relative active:translate-y-1 active:shadow-none transition-all ${hasActiveCrate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-amber-700 animate-pulse'}`}
                    >
                        <div className="w-16 h-2 bg-amber-900 mb-1 rounded"></div>
                        <div className="w-16 h-2 bg-amber-900 mb-1 rounded"></div>
                        <div className="w-16 h-2 bg-amber-900 mb-1 rounded"></div>
                        {!hasActiveCrate && (
                            <div className="absolute -top-4 text-2xl animate-bounce">👇</div>
                        )}
                    </button>
               </div>

           </div>
       </div>

       {/* Conveyor Belt Visual */}
       <div className="absolute bottom-0 w-full h-24 bg-gray-700 border-t-8 border-gray-600 z-0 flex items-center overflow-hidden">
            {/* Belt Texture */}
            <div className="absolute inset-0 opacity-20 animate-conveyor" style={{ 
                backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 40px, #000 40px, #000 44px)',
                backgroundSize: '100% 100%'
            }}></div>
            
            <style>{`
                @keyframes slideBelt {
                    from { background-position: 0 0; }
                    to { background-position: 88px 0; }
                }
                .animate-conveyor {
                    animation: slideBelt 1s linear infinite;
                }
            `}</style>
            
            {/* Shipped Crates */}
            {shippedCrates.map((b) => (
                <div 
                    key={b.id}
                    className="absolute bottom-6 w-32 h-24 bg-amber-700 border-4 border-amber-900 rounded-lg flex items-center justify-center shadow-2xl z-10"
                    style={{
                        left: '50%',
                        animation: 'conveyorMove 2s linear forwards',
                    }}
                >
                    <span className="text-4xl">📦</span>
                    <div className="absolute -top-6 text-green-400 font-black text-xl animate-bounce">+1</div>
                    {/* Tape on shipped box */}
                    <div className="w-full h-6 bg-yellow-400/80 -rotate-12 absolute border border-yellow-600"></div>
                </div>
            ))}
            
            {/* Score Display on Machine */}
            <div className="absolute left-4 bottom-4 bg-black border-4 border-gray-500 px-3 py-1 rounded text-red-500 font-mono text-xl shadow-[0_0_10px_red] z-20">
                {score.toString().padStart(3, '0')}
            </div>
       </div>

       {/* Start / Game Over Overlay */}
       {gameState === 'IDLE' && (
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full border-8 border-pink-300 animate-pop-in">
                   <div className="text-6xl mb-4">🐄📦</div>
                   <h1 className="text-3xl font-black text-amber-800 mb-2">急速擠奶王</h1>
                   <div className="text-left bg-orange-50 p-4 rounded-xl mb-6 text-sm text-gray-700 border border-orange-100">
                       <p className="font-bold mb-1">🎮 完整流程:</p>
                       <ol className="space-y-2 mt-2 list-decimal list-inside">
                           <li>擠奶: 長按乳頭裝滿瓶子。</li>
                           <li>裝箱: 按 <span className="text-green-600 font-bold">➡</span> 放入箱子。</li>
                           <li>出貨: 箱子滿了(6瓶) <span className="text-red-500 font-bold">點擊箱子</span> 送走。</li>
                           <li>補貨: 點擊右側 <span className="text-amber-700 font-bold">空箱堆</span> 拿新箱子。</li>
                       </ol>
                   </div>
                   <button onClick={startGame} className="bg-amber-500 hover:bg-amber-600 text-white text-2xl font-bold py-4 px-10 rounded-full shadow-lg w-full border-b-8 border-amber-700 active:border-b-0 active:translate-y-2 transition-all">
                       開始工作!
                   </button>
               </div>
           </div>
       )}

       {gameState === 'GAME_OVER' && (
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full border-8 border-red-400 animate-bounce-in">
                   <div className="text-6xl mb-4">{anger >= MAX_ANGER ? '🦶💥' : '🏁'}</div>
                   <h2 className="text-3xl font-black text-gray-800 mb-2">
                       {anger >= MAX_ANGER ? '被踢飛了！' : '下班啦！'}
                   </h2>
                   <p className="text-gray-500 mb-4">{anger >= MAX_ANGER ? '母牛太生氣了' : '今日產量統計'}</p>
                   
                   <div className="bg-amber-100 p-4 rounded-xl mb-6">
                       <p className="text-xs font-bold text-amber-600 uppercase">Shipped Crates</p>
                       <p className="text-6xl font-black text-amber-800">{score}</p>
                   </div>

                   <button onClick={startGame} className="bg-green-500 hover:bg-green-600 text-white text-xl font-bold py-3 px-8 rounded-full shadow-lg transform transition active:scale-95 border-b-4 border-green-700 w-full">
                       再試一次 🔄
                   </button>
               </div>
           </div>
       )}

    </div>
  );
};

export default MilkingGame;
