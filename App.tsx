import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameStatus, Mole, MoleState } from './types';
import CustomCursor from './components/CustomCursor';
import Hole from './components/Hole';
import { generateGameCommentary } from './services/geminiService';
import { playSound } from './services/soundService';

const GAME_DURATION = 30; // seconds
const MOLE_COUNT = 9;

// Level Configuration
const LEVEL_CONFIG = {
  1: { tickRate: 700, prob: 0.5, stayTime: 1000, name: "新手農夫" },
  2: { tickRate: 550, prob: 0.7, stayTime: 750, name: "熟練牛仔" },
  3: { tickRate: 450, prob: 0.85, stayTime: 550, name: "傳奇牧場主" }
};

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [level, setLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [moles, setMoles] = useState<Mole[]>([]);
  const [isClicking, setIsClicking] = useState(false);
  const [commentary, setCommentary] = useState<string>('');
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  
  // Refs
  const gameLoopRef = useRef<number | null>(null);
  const moleTimeoutsRef = useRef<{ [key: number]: number }>({});
  const currentLevelRef = useRef(1); // To access current level inside intervals

  // Initialize moles
  useEffect(() => {
    const initialMoles = Array.from({ length: MOLE_COUNT }, (_, i) => ({
      id: i,
      state: MoleState.HIDDEN,
      nextAppearanceTime: 0,
    }));
    setMoles(initialMoles);
  }, []);

  // Update level ref when state changes
  useEffect(() => {
    currentLevelRef.current = level;
  }, [level]);

  // Handle Level Progression
  useEffect(() => {
    let newLevel = 1;
    if (score >= 25) newLevel = 3;
    else if (score >= 10) newLevel = 2;

    if (newLevel !== level) {
      setLevel(newLevel);
      if (gameStatus === GameStatus.PLAYING) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 1500);
      }
    }
  }, [score, level, gameStatus]);

  // Handle Mouse Click Animation & Sound
  const handleMouseDown = () => {
    setIsClicking(true);
    if (gameStatus === GameStatus.PLAYING) {
      playSound('MOO');
    }
  };
  const handleMouseUp = () => setIsClicking(false);

  useEffect(() => {
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameStatus]);

  // Game Logic
  const startGame = () => {
    setScore(0);
    setLevel(1);
    setTimeLeft(GAME_DURATION);
    setGameStatus(GameStatus.PLAYING);
    setCommentary('');
    setShowLevelUp(false);
    
    // Reset moles
    setMoles(prev => prev.map(m => ({ ...m, state: MoleState.HIDDEN })));
  };

  const endGame = useCallback(async () => {
    setGameStatus(GameStatus.GAME_OVER);
    
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    Object.values(moleTimeoutsRef.current).forEach(clearTimeout);

    // Fetch commentary
    setLoadingCommentary(true);
    const result = await generateGameCommentary(score, 60);
    setCommentary(result);
    setLoadingCommentary(false);
  }, [score]);

  // Timer Effect
  useEffect(() => {
    if (gameStatus === GameStatus.PLAYING) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameStatus, endGame]);

  // Mole Popping Logic with Dynamic Level Speed
  useEffect(() => {
    if (gameStatus !== GameStatus.PLAYING) return;

    // We use a function that re-schedules itself to handle dynamic tick rates if needed, 
    // but for simplicity here with setInterval, we just need to ensure the interval
    // can handle the logic or restart if rate changes. 
    // To keep it simple: Fixed fast tick, but check logic based on level params.
    
    const tick = () => {
      const config = LEVEL_CONFIG[currentLevelRef.current as keyof typeof LEVEL_CONFIG];
      
      setMoles(prevMoles => {
        const newMoles = [...prevMoles];
        let changed = false;

        // Probabilistic Spawn
        if (Math.random() < config.prob) { 
           const hiddenIndices = newMoles
            .map((m, i) => m.state === MoleState.HIDDEN ? i : -1)
            .filter(i => i !== -1);
           
           if (hiddenIndices.length > 0) {
             const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
             const mole = newMoles[randomIndex];
             
             // Pop it up
             mole.state = MoleState.VISIBLE;
             changed = true;

             // Schedule it to go down
             if (moleTimeoutsRef.current[mole.id]) clearTimeout(moleTimeoutsRef.current[mole.id]);
             moleTimeoutsRef.current[mole.id] = setTimeout(() => {
               setMoles(current => {
                 const m = current[randomIndex];
                 if (m.state === MoleState.VISIBLE) { // Only hide if still visible (not hit)
                    const updated = [...current];
                    updated[randomIndex] = { ...m, state: MoleState.HIDDEN };
                    return updated;
                 }
                 return current;
               });
             }, config.stayTime);
           }
        }
        return changed ? newMoles : prevMoles;
      });
    };

    // Run tick frequently enough to feel responsive
    gameLoopRef.current = setInterval(tick, 500); 
    
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameStatus]);

  const handleHit = useCallback((id: number) => {
    setMoles(prev => {
      const newMoles = [...prev];
      const mole = newMoles[id];
      if (mole.state === MoleState.VISIBLE) {
        playSound('SQUEAL'); // Play Hit Sound
        mole.state = MoleState.HIT;
        setScore(s => s + 1);
        
        // Reset after animation
        if (moleTimeoutsRef.current[id]) clearTimeout(moleTimeoutsRef.current[id]);
        moleTimeoutsRef.current[id] = setTimeout(() => {
          setMoles(current => {
             const updated = [...current];
             updated[id] = { ...updated[id], state: MoleState.HIDDEN };
             return updated;
          });
        }, 400); // Show dizzy for a bit
        
        return newMoles;
      }
      return prev;
    });
  }, []);

  // Background Gradient based on Level
  const getBgGradient = () => {
    if (level === 2) return "from-orange-300 to-green-200";
    if (level === 3) return "from-red-300 to-orange-200";
    return "from-sky-300 to-green-200";
  };

  return (
    <div className={`min-h-screen bg-gradient-to-b ${getBgGradient()} flex flex-col items-center justify-center relative font-sans text-neutral-800 transition-colors duration-1000`}>
      <CustomCursor isClicking={isClicking} />

      {/* Level Up Overlay */}
      {showLevelUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="animate-pop-in bg-yellow-400 border-4 border-white text-amber-900 px-12 py-6 rounded-3xl shadow-2xl transform rotate-[-5deg]">
            <h2 className="text-6xl font-black drop-shadow-md">LEVEL {level}!</h2>
            <p className="text-2xl font-bold text-center mt-2">{LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG].name}</p>
          </div>
        </div>
      )}

      {/* Header / Scoreboard */}
      <div className="absolute top-4 w-full px-4 md:px-8 max-w-4xl flex justify-between items-center z-30">
        <div className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border-2 border-white flex flex-col items-center">
            <p className="text-sm font-bold text-amber-600 uppercase">Score</p>
            <p className="text-3xl font-black text-amber-900 leading-none">{score}</p>
        </div>
        
        <div className="flex flex-col items-center">
             {gameStatus === GameStatus.PLAYING && (
                <div className="bg-black/20 px-4 py-1 rounded-full text-white font-bold mb-2 backdrop-blur-sm border border-white/30">
                  Lv.{level} {LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG].name}
                </div>
             )}
             {gameStatus === GameStatus.IDLE && (
                <h1 className="hidden md:block text-4xl font-black text-white drop-shadow-lg tracking-wider stroke-black">小牛打小豬</h1>
             )}
        </div>

        <div className={`px-6 py-3 rounded-2xl shadow-lg border-2 border-white flex flex-col items-center ${timeLeft < 10 ? 'bg-red-100 animate-pulse text-red-600' : 'bg-white/80 text-amber-700'}`}>
            <p className="text-sm font-bold uppercase">Time</p>
            <p className="text-3xl font-black leading-none">{timeLeft}s</p>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative z-10 p-4 md:p-8 rounded-3xl bg-green-600 shadow-[inset_0_0_60px_rgba(0,0,0,0.3)] border-b-8 border-green-800 mt-16 max-w-2xl w-full mx-4">
        <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:gap-x-8 sm:gap-y-12">
          {moles.map((mole) => (
            <Hole key={mole.id} mole={mole} onHit={handleHit} />
          ))}
        </div>
      </div>
      
      {/* Decorative Grass */}
      <div className="fixed bottom-0 w-full h-16 bg-gradient-to-t from-green-800 to-transparent pointer-events-none z-0"></div>

      {/* Start Screen Modal */}
      {gameStatus === GameStatus.IDLE && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border-4 border-amber-300 transform transition-all hover:scale-105">
            <div className="text-6xl mb-4">🐮 🆚 🐷</div>
            <h1 className="text-3xl font-black text-amber-800 mb-2">小牛打小豬</h1>
            <div className="text-left bg-orange-50 p-4 rounded-xl mb-6 text-sm text-gray-700 border border-orange-100">
              <p className="font-bold mb-1">🎮 怎麼玩:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>揮動木槌 (點擊) 敲擊小豬</li>
                <li>注意! 敲槌子會發出 <b>哞~</b> 叫聲</li>
                <li>敲到小豬會發出 <b>慘叫聲</b></li>
                <li>分數越高，關卡越難!</li>
              </ul>
            </div>
            <button 
              onClick={startGame}
              className="bg-amber-500 hover:bg-amber-600 text-white text-2xl font-bold py-4 px-10 rounded-full shadow-lg transform transition active:scale-95 active:bg-amber-700 w-full"
            >
              開始遊戲!
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameStatus === GameStatus.GAME_OVER && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center border-4 border-amber-300 animate-bounce-in">
            <h2 className="text-4xl font-black text-amber-800 mb-4">遊戲結束!</h2>
            <div className="flex justify-center items-end gap-2 mb-6">
              <span className="text-gray-600 font-bold pb-2">最終等級: {level}</span>
              <span className="text-amber-600 text-6xl font-black">{score}</span>
              <span className="text-gray-600 font-bold pb-2">分</span>
            </div>
            
            <div className="bg-amber-50 rounded-xl p-4 mb-6 text-left border border-amber-100">
               <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-2">
                 <span className="bg-amber-200 p-1 rounded">🤖</span> AI 賽評回顧
               </h3>
               {loadingCommentary ? (
                 <div className="flex space-x-2 justify-center py-4">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce delay-75"></div>
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce delay-150"></div>
                 </div>
               ) : (
                 <p className="text-gray-700 italic leading-relaxed">
                   "{commentary}"
                 </p>
               )}
            </div>

            <div className="flex justify-center gap-4">
              <button 
                onClick={startGame}
                className="bg-green-500 hover:bg-green-600 text-white text-xl font-bold py-3 px-8 rounded-full shadow-lg transform transition active:scale-95"
              >
                再玩一次
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;