import React, { useState, useEffect, useRef } from 'react';
import { startPeppaBGM, stopBGM, playSound } from '../services/soundService';

interface RhythmGameProps {
  onBack: () => void;
}

interface Note {
  id: number;
  lane: 0 | 1 | 2;
  y: number; // Percentage 0-100 represents position on track
  hit: boolean;
  missed: boolean;
}

const HIT_ZONE_Y = 85; // The target line position (%)
const HIT_WINDOW = 12; // Allowance (+/- %)
const BASE_SPEED = 0.5; // Base movement speed per frame
const BASE_SPAWN_RATE = 600; // Base ms between spawns (100 BPM)
const MAX_LIVES = 5;

const RhythmGame: React.FC<RhythmGameProps> = ({ onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [difficulty, setDifficulty] = useState(1.0); // Multiplier for speed and spawn rate
  const [notes, setNotes] = useState<Note[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; color: string; id: number } | null>(null);
  
  const reqRef = useRef<number>(0);
  const spawnTimeoutRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBGM();
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
    };
  }, []);

  // Increase difficulty based on score
  useEffect(() => {
    if (score > 0) {
      // Every 50 points, increase difficulty by 0.1, cap at 2.5x speed
      const newDiff = Math.min(1 + Math.floor(score / 50) * 0.1, 2.5);
      setDifficulty(newDiff);
    }
  }, [score]);

  // Handle Game Over
  useEffect(() => {
    if (lives <= 0 && isPlaying) {
      setIsPlaying(false);
      setGameOver(true);
      stopBGM();
    }
  }, [lives, isPlaying]);

  // Spawner Logic (Recursive Timeout for dynamic speed)
  const scheduleNextSpawn = () => {
    if (!isPlaying || lives <= 0) return;

    const currentRate = BASE_SPAWN_RATE / difficulty;
    
    spawnTimeoutRef.current = window.setTimeout(() => {
      setNotes(prev => [
        ...prev,
        {
          id: Date.now(),
          lane: Math.floor(Math.random() * 3) as 0 | 1 | 2,
          y: -20,
          hit: false,
          missed: false
        }
      ]);
      scheduleNextSpawn();
    }, currentRate);
  };

  // Game Start Effect
  useEffect(() => {
    if (isPlaying && !gameOver) {
      startPeppaBGM();
      scheduleNextSpawn();
      
      const loop = () => {
        setNotes(prev => {
          // Move notes based on difficulty
          const currentSpeed = BASE_SPEED * difficulty;
          const movedNotes = prev.map(n => ({ ...n, y: n.y + currentSpeed }));
          
          let missDetected = false;

          // Check for misses
          movedNotes.forEach(n => {
             if (n.y > 105 && !n.hit && !n.missed) {
               n.missed = true;
               missDetected = true;
             }
          });

          if (missDetected) {
             setCombo(0);
             setLives(l => Math.max(0, l - 1));
             playSound('RHYTHM_MISS');
             setFeedback({ text: "MISS", color: "text-gray-500", id: Date.now() });
             setTimeout(() => setFeedback(null), 500);
          }

          return movedNotes.filter(n => n.y < 120);
        });
        
        reqRef.current = requestAnimationFrame(loop);
      };

      reqRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      if (spawnTimeoutRef.current) clearTimeout(spawnTimeoutRef.current);
    };
  }, [isPlaying, gameOver, difficulty]);

  const handleLanePress = (laneIndex: number) => {
    if (!isPlaying) return;

    const hittableNotes = notes.filter(
      n => n.lane === laneIndex && !n.hit && !n.missed && Math.abs(n.y - HIT_ZONE_Y) < HIT_WINDOW + 5
    );

    hittableNotes.sort((a, b) => Math.abs(a.y - HIT_ZONE_Y) - Math.abs(b.y - HIT_ZONE_Y));
    
    const targetNote = hittableNotes[0];

    if (targetNote) {
      const distance = Math.abs(targetNote.y - HIT_ZONE_Y);
      
      if (distance < HIT_WINDOW) {
        // HIT!
        const isPerfect = distance < 5;
        const points = isPerfect ? 20 : 10;
        const text = isPerfect ? "PERFECT!" : "GOOD!";
        const color = isPerfect ? "text-yellow-500" : "text-green-500";

        playSound('RHYTHM_HIT');
        setScore(s => s + points + combo);
        setCombo(c => c + 1);
        
        setNotes(prev => prev.map(n => n.id === targetNote.id ? { ...n, hit: true } : n));
        
        setFeedback({ text, color, id: Date.now() });
        setTimeout(() => setFeedback(null), 500);
      } else {
         // Bad hit = Miss
         setCombo(0);
         setLives(l => Math.max(0, l - 1));
         setFeedback({ text: "MISS", color: "text-gray-500", id: Date.now() });
         setTimeout(() => setFeedback(null), 500);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') handleLanePress(0);
    if (e.key === 'ArrowDown' || e.key === 's') handleLanePress(1);
    if (e.key === 'ArrowRight' || e.key === 'd') handleLanePress(2);
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, notes]);

  const restartGame = () => {
    setScore(0);
    setCombo(0);
    setLives(MAX_LIVES);
    setDifficulty(1.0);
    setNotes([]);
    setGameOver(false);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-pink-50 flex flex-col font-sans select-none touch-none overflow-hidden">
      
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-30">
        <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(#fca5a5 2px, transparent 2px)',
            backgroundSize: '40px 40px'
        }}></div>
        <div className="absolute top-10 left-10 text-8xl animate-bounce" style={{ animationDuration: '4s' }}>🐮</div>
        <div className="absolute top-32 right-12 text-8xl animate-bounce" style={{ animationDuration: '5s', animationDelay: '1s' }}>🐷</div>
        <div className="absolute bottom-40 left-8 text-7xl animate-pulse" style={{ animationDuration: '3s' }}>🐷</div>
        <div className="absolute bottom-20 right-1/4 text-9xl animate-pulse" style={{ animationDuration: '6s' }}>🐮</div>
      </div>

      {/* Header with Lives */}
      <div className="relative z-30 flex justify-between items-center px-6 py-4 bg-white/70 backdrop-blur-md shadow-sm border-b-4 border-pink-200">
        <button onClick={onBack} className="bg-pink-400 text-white px-4 py-2 rounded-full font-bold shadow-md hover:bg-pink-500 transition active:scale-95 border-b-4 border-pink-600 active:border-b-0 active:translate-y-1 text-sm sm:text-base">
          ⬅️ 離開
        </button>
        
        {/* Score & Lives Center */}
        <div className="flex flex-col items-center">
             <div className="flex gap-1 mb-1">
               {Array.from({length: MAX_LIVES}).map((_, i) => (
                 <span key={i} className={`text-xl transition-all ${i < lives ? 'scale-100 opacity-100' : 'scale-75 opacity-20 grayscale'}`}>
                   {i < lives ? '❤️' : '💔'}
                 </span>
               ))}
             </div>
             <div className="text-pink-600 font-black text-3xl leading-none drop-shadow-sm">
                {score}
             </div>
        </div>

        <div className="w-20 text-right font-black text-amber-500 text-xl drop-shadow-sm">
           {combo > 1 && `x${combo}🔥`}
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 relative w-full max-w-lg mx-auto z-10 px-4 pb-32">
        <div className="w-full h-full bg-white/40 border-x-8 border-pink-200 relative flex shadow-2xl backdrop-blur-sm rounded-b-3xl overflow-hidden">
          
          {/* Lanes */}
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 border-r-2 border-pink-100/50 last:border-r-0 relative group">
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pink-50/20 to-pink-200/60"></div>
               <div className="absolute bottom-24 w-full text-center text-pink-400 font-bold opacity-40 text-5xl">
                 {i === 0 ? '←' : i === 1 ? '↓' : '→'}
               </div>
            </div>
          ))}

          {/* Hit Zone */}
          <div 
             className="absolute w-full h-2 bg-pink-400/60 shadow-[0_0_10px_rgba(244,114,182,0.8)] z-0" 
             style={{ top: `${HIT_ZONE_Y}%` }}
          ></div>

          {/* Notes */}
          {notes.map(note => (
            !note.hit && (
              <div
                key={note.id}
                className="absolute w-1/3 flex justify-center items-center pointer-events-none"
                style={{
                  left: `${note.lane * 33.33}%`,
                  top: `${note.y}%`, 
                  height: '0px',
                  transform: 'translateY(-50%)'
                }}
              >
                 <div className={`text-6xl filter drop-shadow-lg transition-transform ${note.missed ? 'grayscale opacity-40 scale-75' : 'animate-bounce'}`}>
                   🐮
                 </div>
              </div>
            )
          ))}
          
          {/* Feedback */}
          {feedback && (
             <div className="absolute top-1/2 left-0 w-full flex justify-center items-center z-50 pointer-events-none">
               <div className="relative">
                  <div className={`text-7xl font-black ${feedback.color} animate-ping opacity-50 absolute inset-0 text-center`}>{feedback.text}</div>
                  <div className={`text-7xl font-black ${feedback.color} relative text-center drop-shadow-md`}>{feedback.text}</div>
               </div>
             </div>
          )}
        </div>
      </div>

      {/* Piggy Drum Controls */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white via-white/90 to-transparent z-40">
        <div className="flex justify-center gap-4 max-w-lg mx-auto">
          {[0, 1, 2].map(lane => (
            <button
              key={lane}
              className="w-24 h-24 sm:w-28 sm:h-28 bg-pink-300 rounded-full border-b-8 border-pink-500 active:border-b-0 active:translate-y-2 transition-all shadow-xl flex items-center justify-center group active:bg-pink-400 relative overflow-hidden ring-4 ring-pink-100"
              onTouchStart={(e) => { e.preventDefault(); handleLanePress(lane); }}
              onMouseDown={(e) => { e.preventDefault(); handleLanePress(lane); }}
            >
              {/* Piggy Face Styling */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 {/* Ears */}
                 <div className="absolute -top-2 -left-2 w-8 h-8 bg-pink-400 rounded-full"></div>
                 <div className="absolute -top-2 -right-2 w-8 h-8 bg-pink-400 rounded-full"></div>
                 
                 {/* Snout */}
                 <div className="w-14 h-10 bg-pink-400 rounded-[50%] flex justify-center items-center gap-2 shadow-inner group-active:scale-95 transition-transform">
                    <div className="w-3 h-4 bg-pink-800 rounded-full"></div>
                    <div className="w-3 h-4 bg-pink-800 rounded-full"></div>
                 </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Start Game Overlay */}
      {!isPlaying && !gameOver && (
        <div className="absolute inset-0 z-50 bg-pink-500/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm border-8 border-pink-200 animate-pop-in transform rotate-1">
              <div className="flex justify-center gap-4 mb-4 text-6xl">
                 <span>🐮</span><span>❤️</span><span>🐷</span>
              </div>
              <h1 className="text-4xl font-black text-pink-600 mb-2">小牛跳跳樂</h1>
              <div className="bg-pink-50 rounded-xl p-4 mb-6 text-gray-600 font-bold leading-relaxed text-sm">
                <p className="mb-2">1. 節奏會越來越快喔！</p>
                <p className="mb-2">2. 你有 <span className="text-red-500">5顆愛心</span> 機會</p>
                <p>3. 點擊 <span className="bg-pink-300 text-pink-800 px-1 rounded">小豬鼓</span> 來接住小牛</p>
              </div>
              <button 
                onClick={() => { setIsPlaying(true); setLives(MAX_LIVES); setScore(0); setDifficulty(1.0); }}
                className="bg-green-400 hover:bg-green-500 text-white text-2xl font-black py-4 px-12 rounded-full shadow-lg transform transition active:scale-95 border-b-8 border-green-600 w-full group"
              >
                <span className="group-hover:animate-pulse inline-block">▶️</span> 開始播放!
              </button>
           </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm border-8 border-gray-200 animate-bounce-in">
              <div className="text-6xl mb-4">💔😭</div>
              <h2 className="text-4xl font-black text-gray-700 mb-2">遊戲結束</h2>
              <div className="my-6">
                 <div className="text-gray-500 font-bold uppercase text-sm">Final Score</div>
                 <div className="text-6xl font-black text-pink-600">{score}</div>
                 <div className="text-gray-400 text-sm mt-1">最高速度: x{difficulty.toFixed(1)}</div>
              </div>
              <button 
                onClick={restartGame}
                className="bg-blue-400 hover:bg-blue-500 text-white text-xl font-black py-3 px-8 rounded-full shadow-lg transform transition active:scale-95 border-b-4 border-blue-600 w-full mb-3"
              >
                再玩一次 🔄
              </button>
              <button onClick={onBack} className="text-gray-500 font-bold hover:text-gray-700 underline">
                回到主選單
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default RhythmGame;