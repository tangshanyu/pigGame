
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameStatus, Mole, MoleState, MoleType } from '../types';
import CustomCursor from './CustomCursor';
import Hole from './Hole';
import { generateGameCommentary } from '../services/geminiService';
import { playSound } from '../services/soundService';

const GAME_DURATION = 30; // seconds
const MOLE_COUNT = 9;

const LEVEL_CONFIG = {
  1: { tickRate: 700, prob: 0.5, stayTime: 1000, name: "新手農夫", types: ['NORMAL'] },
  2: { tickRate: 550, prob: 0.7, stayTime: 750, name: "熟練牛仔", types: ['NORMAL', 'NORMAL', 'GOLD'] },
  3: { tickRate: 450, prob: 0.85, stayTime: 550, name: "傳奇牧場主", types: ['NORMAL', 'GOLD', 'BOMB'] }
};

interface WhacAMoleGameProps {
  onBack: () => void;
}

const WhacAMoleGame: React.FC<WhacAMoleGameProps> = ({ onBack }) => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [level, setLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [moles, setMoles] = useState<Mole[]>([]);
  const [isClicking, setIsClicking] = useState(false);
  const [commentary, setCommentary] = useState<string>('');
  const [loadingCommentary, setLoadingCommentary] = useState(false);
  const [screenShake, setScreenShake] = useState(false); // For Bomb hit
  
  const gameLoopRef = useRef<number | null>(null);
  const moleTimeoutsRef = useRef<{ [key: number]: number }>({});
  const currentLevelRef = useRef(1);

  useEffect(() => {
    const initialMoles = Array.from({ length: MOLE_COUNT }, (_, i) => ({
      id: i,
      state: MoleState.HIDDEN,
      nextAppearanceTime: 0,
      type: 'NORMAL' as MoleType
    }));
    setMoles(initialMoles);
  }, []);

  useEffect(() => {
    currentLevelRef.current = level;
  }, [level]);

  useEffect(() => {
    // Dynamic Difficulty
    let newLevel = 1;
    if (score >= 200) newLevel = 3;
    else if (score >= 50) newLevel = 2;

    if (newLevel !== level) {
      setLevel(newLevel);
      if (gameStatus === GameStatus.PLAYING) {
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 1500);
      }
    }
  }, [score, level, gameStatus]);

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

  const startGame = () => {
    setScore(0);
    setCombo(0);
    setLevel(1);
    setTimeLeft(GAME_DURATION);
    setGameStatus(GameStatus.PLAYING);
    setCommentary('');
    setShowLevelUp(false);
    setScreenShake(false);
    setMoles(prev => prev.map(m => ({ ...m, state: MoleState.HIDDEN, type: 'NORMAL' })));
  };

  const endGame = useCallback(async () => {
    setGameStatus(GameStatus.GAME_OVER);
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    Object.values(moleTimeoutsRef.current).forEach(clearTimeout);
    setLoadingCommentary(true);
    const result = await generateGameCommentary(score, 500);
    setCommentary(result);
    setLoadingCommentary(false);
  }, [score]);

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

  useEffect(() => {
    if (gameStatus !== GameStatus.PLAYING) return;
    const tick = () => {
      const config = LEVEL_CONFIG[currentLevelRef.current as keyof typeof LEVEL_CONFIG];
      setMoles(prevMoles => {
        const newMoles = [...prevMoles];
        let changed = false;
        
        // Chance to spawn
        if (Math.random() < config.prob) { 
           const hiddenIndices = newMoles
            .map((m, i) => m.state === MoleState.HIDDEN ? i : -1)
            .filter(i => i !== -1);
            
           if (hiddenIndices.length > 0) {
             const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
             const mole = newMoles[randomIndex];
             
             // Determine Type
             const availableTypes = (config as any).types || ['NORMAL'];
             const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

             mole.state = MoleState.VISIBLE;
             mole.type = type;
             
             changed = true;
             
             if (moleTimeoutsRef.current[mole.id]) clearTimeout(moleTimeoutsRef.current[mole.id]);
             
             // Stay time depends on type (Gold is faster)
             let stayDuration = config.stayTime;
             if (type === 'GOLD') stayDuration *= 0.6;
             
             moleTimeoutsRef.current[mole.id] = setTimeout(() => {
               setMoles(current => {
                 const m = current[randomIndex];
                 if (m.state === MoleState.VISIBLE) {
                    const updated = [...current];
                    updated[randomIndex] = { ...m, state: MoleState.HIDDEN };
                    // Missed normal/gold -> maybe break combo? Nah, let's keep combo for Hits only to be kind
                    return updated;
                 }
                 return current;
               });
             }, stayDuration);
           }
        }
        return changed ? newMoles : prevMoles;
      });
    };
    gameLoopRef.current = setInterval(tick, 500); 
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameStatus]);

  const handleHit = useCallback((id: number, type: MoleType) => {
    setMoles(prev => {
      const newMoles = [...prev];
      const mole = newMoles[id];
      if (mole.state === MoleState.VISIBLE) {
        
        // Hit Logic
        if (type === 'BOMB') {
            playSound('BOMB_HIT');
            setScore(s => Math.max(0, s - 50));
            setCombo(0);
            setScreenShake(true);
            setTimeout(() => setScreenShake(false), 500);
        } else {
            const baseScore = type === 'GOLD' ? 50 : 10;
            // Combo Bonus: +1 per 5 combo
            setCombo(c => {
                const newCombo = c + 1;
                // Bonus calculation inside score setter
                return newCombo;
            });
            setScore(s => s + baseScore + Math.floor(combo / 5) * 5); // Simple bonus
            playSound(type === 'GOLD' ? 'GOLD_HIT' : 'SQUEAL');
        }

        mole.state = MoleState.HIT;
        
        if (moleTimeoutsRef.current[id]) clearTimeout(moleTimeoutsRef.current[id]);
        moleTimeoutsRef.current[id] = setTimeout(() => {
          setMoles(current => {
             const updated = [...current];
             updated[id] = { ...updated[id], state: MoleState.HIDDEN };
             return updated;
          });
        }, 400);
        return newMoles;
      }
      return prev;
    });
  }, [combo]); // Depend on combo for updated score calculation? No, use functional update for score

  const getBgGradient = () => {
    if (level === 2) return "from-orange-300 to-green-200";
    if (level === 3) return "from-red-300 to-orange-200";
    return "from-sky-300 to-green-200";
  };

  return (
    <div className={`min-h-screen w-full bg-gradient-to-b ${getBgGradient()} flex flex-col items-center justify-center relative font-sans text-neutral-800 transition-colors duration-1000 cursor-none touch-none ${screenShake ? 'animate-shake bg-red-200' : ''}`}>
      <CustomCursor isClicking={isClicking} />

      {/* Back Button */}
      <div className="absolute top-4 left-4 z-50">
        <button onClick={onBack} className="bg-white/80 p-2 rounded-full hover:bg-white transition shadow-lg cursor-pointer">
          ⬅️ 返回選單
        </button>
      </div>

      {showLevelUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="animate-pop-in bg-yellow-400 border-4 border-white text-amber-900 px-12 py-6 rounded-3xl shadow-2xl transform rotate-[-5deg]">
            <h2 className="text-6xl font-black drop-shadow-md">LEVEL {level}!</h2>
            <p className="text-2xl font-bold text-center mt-2">{LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG].name}</p>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-4 w-full px-4 md:px-8 max-w-4xl flex justify-between items-center z-30 pointer-events-none">
        
        {/* Score Board */}
        <div className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg border-2 border-white flex flex-col items-center pointer-events-auto min-w-[120px]">
            <p className="text-sm font-bold text-amber-600 uppercase">Score</p>
            <p className="text-4xl font-black text-amber-900 leading-none">{score}</p>
        </div>
        
        {/* Combo / Level info */}
        <div className="flex flex-col items-center">
             {gameStatus === GameStatus.PLAYING && (
                <>
                    <div className="bg-black/20 px-4 py-1 rounded-full text-white font-bold mb-2 backdrop-blur-sm border border-white/30">
                    Lv.{level} {LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG].name}
                    </div>
                    {combo > 1 && (
                        <div className="text-yellow-400 font-black text-4xl drop-shadow-md animate-bounce">
                            {combo} COMBO!
                        </div>
                    )}
                </>
             )}
        </div>

        {/* Timer */}
        <div className={`px-6 py-3 rounded-2xl shadow-lg border-2 border-white flex flex-col items-center pointer-events-auto ${timeLeft < 10 ? 'bg-red-100 animate-pulse text-red-600' : 'bg-white/80 text-amber-700'}`}>
            <p className="text-sm font-bold uppercase">Time</p>
            <p className="text-3xl font-black leading-none">{timeLeft}s</p>
        </div>
      </div>

      {/* Game Grid */}
      <div className="relative z-10 p-4 md:p-8 rounded-3xl bg-green-600 shadow-[inset_0_0_60px_rgba(0,0,0,0.3)] border-b-8 border-green-800 mt-16 max-w-2xl w-full mx-4">
        <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:gap-x-8 sm:gap-y-12">
          {moles.map((mole) => (
            <Hole key={mole.id} mole={mole} onHit={handleHit} />
          ))}
        </div>
      </div>
      
      {/* Footer Instructions */}
      <div className="fixed bottom-4 text-center text-white/80 text-sm font-bold drop-shadow-md">
         👑 黃金豬 +50 | 🐂 生氣公牛 -50 (勿打!)
      </div>
      <div className="fixed bottom-0 w-full h-16 bg-gradient-to-t from-green-800 to-transparent pointer-events-none z-0"></div>

      {/* Start / Menu Screen */}
      {gameStatus === GameStatus.IDLE && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border-4 border-amber-300 transform transition-all hover:scale-105 cursor-auto">
            <div className="text-6xl mb-4">🐮 🆚 🐷</div>
            <h1 className="text-3xl font-black text-amber-800 mb-2">小牛打小豬</h1>
            <div className="text-left bg-orange-50 p-4 rounded-xl mb-6 text-sm text-gray-700 border border-orange-100">
              <p className="font-bold mb-1">🎮 遊戲規則:</p>
              <ul className="space-y-2 mt-2">
                <li className="flex items-center"><span className="text-2xl mr-2">🐷</span> 一般小豬: <span className="text-green-600 font-bold ml-1">+10分</span></li>
                <li className="flex items-center"><span className="text-2xl mr-2">👑</span> 黃金國王: <span className="text-yellow-600 font-bold ml-1">+50分</span> (速度快!)</li>
                <li className="flex items-center"><span className="text-2xl mr-2">🐂</span> 生氣公牛: <span className="text-red-600 font-bold ml-1 text-lg">扣分!!</span> (不要打)</li>
              </ul>
            </div>
            <button onClick={startGame} className="bg-amber-500 hover:bg-amber-600 text-white text-2xl font-bold py-4 px-10 rounded-full shadow-lg w-full border-b-8 border-amber-700 active:border-b-0 active:translate-y-2 transition-all">
              開始挑戰!
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameStatus === GameStatus.GAME_OVER && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center border-4 border-amber-300 animate-bounce-in cursor-auto">
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
              <button onClick={startGame} className="bg-green-500 hover:bg-green-600 text-white text-xl font-bold py-3 px-8 rounded-full shadow-lg transform transition active:scale-95">
                再玩一次
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhacAMoleGame;
