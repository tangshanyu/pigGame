import React, { useState, useEffect, useRef } from 'react';
import { startFarmBGM, stopBGM, playSound, getAudioTime, BPM } from '../services/soundService';

interface RhythmGameProps {
  onBack: () => void;
}

interface Note {
  id: number;
  lane: 0 | 1 | 2;
  targetTime: number; // The exact AudioContext time this note should be hit
  hit: boolean;
  missed: boolean;
}

// Config
const HIT_ZONE_Y = 80; // % from top
const APPROACH_TIME = 2.0; // Seconds for note to travel from top to hit zone
const HIT_WINDOW_PERFECT = 0.15;
const HIT_WINDOW_GOOD = 0.3;
const SECONDS_PER_BEAT = 60 / BPM;
const MAX_LIVES = 5;
const GAME_DURATION_UNTIL_BOSS = 30; // seconds

// Unlockables
const COW_SKINS = [
  { id: 'default', emoji: '🐮', minScore: 0, name: '哞哞牛' },
  { id: 'cool', emoji: '😎', minScore: 200, name: '墨鏡牛' },
  { id: 'space', emoji: '👽', minScore: 500, name: '外星牛' }
];

const DRUM_SKINS = [
    { id: 'default', color: 'bg-pink-300', ring: 'ring-pink-100', emoji: '🐷', minScore: 0 },
    { id: 'gold', color: 'bg-yellow-400', ring: 'ring-yellow-100', emoji: '👑', minScore: 800 }
];

const RhythmGame: React.FC<RhythmGameProps> = ({ onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gamePhase, setGamePhase] = useState<'PLAYING' | 'BOSS' | 'RESULTS'>('PLAYING');
  
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [notes, setNotes] = useState<Note[]>([]);
  const [feedback, setFeedback] = useState<{ text: string; color: string; id: number } | null>(null);
  const [unlockedNotif, setUnlockedNotif] = useState<string | null>(null);

  // Fever Mode
  const [isFever, setIsFever] = useState(false);

  // Boss Mode State
  const [bossHealth, setBossHealth] = useState(50);
  const [bossMaxHealth] = useState(50);
  const [bossTimer, setBossTimer] = useState(10); // 10 seconds to kill boss
  
  // Refs
  const scoreRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const phaseRef = useRef<'PLAYING' | 'BOSS' | 'RESULTS'>('PLAYING');
  
  // Update refs when state changes
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { phaseRef.current = gamePhase; }, [gamePhase]);

  const [activeLanes, setActiveLanes] = useState<boolean[]>([false, false, false]);
  
  const reqRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const nextSpawnBeatRef = useRef<number>(0);
  const [, setRenderTime] = useState(0);

  // Check Unlocks
  useEffect(() => {
    // Determine unlocked skin based on current score
    const newCow = COW_SKINS.slice().reverse().find(s => score >= s.minScore);
    const newDrum = DRUM_SKINS.slice().reverse().find(s => score >= s.minScore);
    
    // Simple check: In a real app we'd store "unlocked" state persistently. 
    // Here we just notify if they crossed a threshold recently.
    // For simplicity in this loop, we just render the best available.
    
    // Show notification for milestones (hacky way: checking modulo roughly or specific values)
    if (score === 200) { setUnlockedNotif("解鎖造型：墨鏡牛！"); playSound('UNLOCK'); setTimeout(() => setUnlockedNotif(null), 3000); }
    if (score === 500) { setUnlockedNotif("解鎖造型：外星牛！"); playSound('UNLOCK'); setTimeout(() => setUnlockedNotif(null), 3000); }
    if (score === 800) { setUnlockedNotif("解鎖鼓面：黃金豬王！"); playSound('UNLOCK'); setTimeout(() => setUnlockedNotif(null), 3000); }

  }, [score]);

  // Fever Logic
  useEffect(() => {
    if (combo >= 10 && !isFever) {
        setIsFever(true);
        playSound('UNLOCK'); // Sound cue for fever
    } else if (combo === 0 && isFever) {
        setIsFever(false);
    }
  }, [combo, isFever]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopBGM();
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, []);

  // Main Game Loop
  useEffect(() => {
    if (!isPlaying || gamePhase === 'RESULTS') return;

    // Start Phase
    const initGame = async () => {
      // 1. Start Music
      const audioStartTime = await startFarmBGM();
      startTimeRef.current = audioStartTime;
      nextSpawnBeatRef.current = 1; 

      const loop = () => {
        const currentTime = getAudioTime();
        
        // --- BOSS TRIGGER CHECK ---
        if (phaseRef.current === 'PLAYING' && currentTime - startTimeRef.current > GAME_DURATION_UNTIL_BOSS) {
            setGamePhase('BOSS');
            setNotes([]); // Clear notes
            // Stop spawning logic in this loop, handled by UI state
        }

        if (phaseRef.current === 'BOSS') {
            // In Boss phase, we don't spawn notes. We just render visuals.
            // Boss timer logic handled in separate interval or simple check here
             setRenderTime(Date.now());
             reqRef.current = requestAnimationFrame(loop);
             return;
        }

        // --- PLAYING PHASE LOGIC ---
        if (livesRef.current <= 0) {
            setGamePhase('RESULTS');
            setGameOver(true);
            return;
        }

        // Spawning
        const nextTargetTime = startTimeRef.current + (nextSpawnBeatRef.current * SECONDS_PER_BEAT);
        if (currentTime >= nextTargetTime - APPROACH_TIME) {
           const currentScore = scoreRef.current;
           const density = Math.min(0.4 + (currentScore * 0.005), 0.9); 
           if (Math.random() < density) {
              setNotes(prev => [
                ...prev,
                {
                  id: nextSpawnBeatRef.current,
                  lane: Math.floor(Math.random() * 3) as 0 | 1 | 2,
                  targetTime: nextTargetTime,
                  hit: false,
                  missed: false
                }
              ]);
           }
           nextSpawnBeatRef.current++;
        }

        // Update Notes
        setNotes(prev => {
           let hasMiss = false;
           const updatedNotes = prev.map(n => {
             if (!n.hit && !n.missed && currentTime > n.targetTime + HIT_WINDOW_GOOD) {
               n.missed = true;
               hasMiss = true;
             }
             return n;
           });

           if (hasMiss) {
             setCombo(0); // This will kill fever via useEffect
             setLives(l => Math.max(0, l - 1));
             playSound('RHYTHM_MISS');
             setFeedback({ text: "MISS", color: "text-gray-500", id: Date.now() });
             setTimeout(() => setFeedback(null), 400);
           }
           return updatedNotes.filter(n => currentTime < n.targetTime + 1.0);
        });

        setRenderTime(Date.now());
        reqRef.current = requestAnimationFrame(loop);
      };

      reqRef.current = requestAnimationFrame(loop);
    };

    if (gamePhase === 'PLAYING') {
        initGame();
    }

    return () => {
      // Don't stop BGM here if transitioning to Boss, actually we want music to keep going
      // But for simplicity of this code structure, we might restart loop. 
      // Optimized: The loop above handles phase switch without killing BGM.
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isPlaying, gamePhase]);

  // Boss Timer
  useEffect(() => {
    let timer: number;
    if (gamePhase === 'BOSS') {
        timer = window.setInterval(() => {
            setBossTimer(t => {
                if (t <= 0) {
                    // Time up, failed boss
                    setGamePhase('RESULTS');
                    setGameOver(true);
                    stopBGM();
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
    }
    return () => clearInterval(timer);
  }, [gamePhase]);

  // Input Handling
  const handleLanePress = (laneIndex: number) => {
    if (!isPlaying || gamePhase === 'RESULTS') return;
    
    // Visual Tap
    const newActive = [...activeLanes];
    newActive[laneIndex] = true;
    setActiveLanes(newActive);
    setTimeout(() => {
        setActiveLanes(prev => {
            const reset = [...prev];
            reset[laneIndex] = false;
            return reset;
        });
    }, 100);

    // --- BOSS FIGHT INPUT ---
    if (gamePhase === 'BOSS') {
        // Any tap hurts the boss
        playSound('BOSS_HIT');
        setBossHealth(h => {
            const newHealth = h - 1;
            if (newHealth <= 0) {
                // VICTORY
                playSound('BOSS_DEFEATED');
                setScore(s => s + 1000); // Big bonus
                setFeedback({ text: "BOSS DEFEATED!", color: "text-yellow-500", id: Date.now() });
                setGamePhase('RESULTS');
                setGameOver(true);
                stopBGM();
                return 0;
            }
            return newHealth;
        });
        // Slight screen shake or visual feedback could go here
        return;
    }

    // --- NORMAL PLAY INPUT ---
    const currentTime = getAudioTime();
    const validNotes = notes.filter(n => n.lane === laneIndex && !n.hit && !n.missed);
    
    let targetNote: Note | null = null;
    let minDiff = Infinity;

    validNotes.forEach(n => {
      const diff = Math.abs(currentTime - n.targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        targetNote = n;
      }
    });

    if (targetNote && minDiff <= HIT_WINDOW_GOOD) {
      const isPerfect = minDiff <= HIT_WINDOW_PERFECT;
      const basePoints = isPerfect ? 50 : 20;
      const multiplier = isFever ? 2 : 1;
      const points = basePoints * multiplier;
      
      const text = isPerfect ? "PERFECT!" : "GOOD!";
      const color = isPerfect ? "text-yellow-400" : "text-green-400";
      
      playSound('RHYTHM_HIT');
      setScore(s => s + points + (combo * 5));
      setCombo(c => c + 1);
      
      setNotes(prev => prev.map(n => n.id === targetNote!.id ? { ...n, hit: true } : n));
      
      setFeedback({ text: isFever ? `${text} x2` : text, color, id: Date.now() });
      setTimeout(() => setFeedback(null), 400);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') handleLanePress(0);
    if (e.key === 'ArrowDown' || e.key === 's') handleLanePress(1);
    if (e.key === 'ArrowRight' || e.key === 'd') handleLanePress(2);
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, gamePhase, notes]);

  const restartGame = () => {
    setScore(0);
    setCombo(0);
    setLives(MAX_LIVES);
    setNotes([]);
    setGameOver(false);
    setIsPlaying(true);
    setGamePhase('PLAYING');
    setIsFever(false);
    setBossHealth(bossMaxHealth);
    setBossTimer(10);
  };

  // Get current skin assets
  const currentCow = COW_SKINS.slice().reverse().find(s => score >= s.minScore) || COW_SKINS[0];
  const currentDrum = DRUM_SKINS.slice().reverse().find(s => score >= s.minScore) || DRUM_SKINS[0];

  return (
    <div className={`fixed inset-0 w-full h-full flex flex-col font-sans select-none touch-none overflow-hidden transition-colors duration-1000 ${isFever ? 'bg-purple-900' : 'bg-pink-50'}`}>
      
      {/* Fever Mode Background Effects */}
      {isFever && (
          <div className="absolute inset-0 pointer-events-none z-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-500 via-pink-600 to-purple-900 opacity-80 animate-pulse"></div>
              <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIvPjwvc3ZnPg==')] opacity-50"></div>
          </div>
      )}

      {/* Normal Background */}
      {!isFever && (
        <div className="absolute inset-0 pointer-events-none z-0 opacity-30">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#fca5a5 2px, transparent 2px)', backgroundSize: '40px 40px'}}></div>
            <div className="absolute top-10 left-10 text-8xl animate-bounce" style={{ animationDuration: '2s' }}>🐮</div>
            <div className="absolute top-32 right-12 text-8xl animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}>🐷</div>
        </div>
      )}

      {/* Notification Toast */}
      {unlockedNotif && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-bold shadow-xl animate-bounce border-2 border-white">
              🔓 {unlockedNotif}
          </div>
      )}

      {/* Header */}
      <div className="relative z-30 flex justify-between items-center px-6 py-4 bg-white/70 backdrop-blur-md shadow-sm border-b-4 border-pink-200">
        <button onClick={onBack} className="bg-pink-400 text-white px-4 py-2 rounded-full font-bold shadow-md hover:bg-pink-500 transition active:scale-95 border-b-4 border-pink-600 active:border-b-0 active:translate-y-1 text-sm sm:text-base">
          ⬅️ 離開
        </button>
        
        <div className="flex flex-col items-center">
             <div className="flex gap-1 mb-1">
               {Array.from({length: MAX_LIVES}).map((_, i) => (
                 <span key={i} className={`text-xl transition-all ${i < lives ? 'scale-100 opacity-100' : 'scale-75 opacity-20 grayscale'}`}>
                   {i < lives ? '❤️' : '💔'}
                 </span>
               ))}
             </div>
             <div className={`${isFever ? 'text-yellow-300 scale-110 drop-shadow-[0_0_10px_rgba(253,224,71,0.8)]' : 'text-pink-600'} font-black text-3xl leading-none transition-all`}>
                {score}
             </div>
             {isFever && <div className="text-xs font-bold text-white bg-red-500 px-2 rounded animate-pulse">FEVER x2</div>}
        </div>

        <div className="w-20 text-right font-black text-amber-500 text-xl drop-shadow-sm">
           {combo > 1 && `x${combo}🔥`}
        </div>
      </div>

      {/* BOSS BATTLE UI */}
      {gamePhase === 'BOSS' && (
          <div className="flex-1 relative z-20 flex flex-col items-center justify-center animate-shake">
              <div className="w-full max-w-md px-4 mb-4">
                  <div className="flex justify-between text-white font-bold mb-1 shadow-black drop-shadow-md">
                      <span>BOSS HP</span>
                      <span>TIME: {bossTimer}s</span>
                  </div>
                  <div className="w-full h-8 bg-gray-700 rounded-full border-4 border-white overflow-hidden shadow-xl">
                      <div 
                        className="h-full bg-red-600 transition-all duration-75"
                        style={{ width: `${(bossHealth / bossMaxHealth) * 100}%` }}
                      ></div>
                  </div>
              </div>
              <div className="relative">
                  <div className="text-[10rem] filter drop-shadow-2xl animate-pulse">🐷👑</div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-600 font-black text-6xl -rotate-12 border-text-white pointer-events-none opacity-0 active:opacity-100 transition-opacity">
                      POW!
                  </div>
              </div>
              <div className="mt-8 text-white text-2xl font-black animate-bounce bg-black/50 px-4 py-2 rounded-xl">
                  狂點下面按鈕攻擊！
              </div>
          </div>
      )}

      {/* Game Area (Notes) - Hidden during Boss */}
      {gamePhase === 'PLAYING' && (
        <div className="flex-1 relative w-full max-w-lg mx-auto z-10 px-4 pb-32">
            <div className="w-full h-full bg-white/40 border-x-8 border-pink-200 relative flex shadow-2xl backdrop-blur-sm rounded-b-3xl overflow-hidden">
            
            {/* Lanes */}
            {[0, 1, 2].map(i => (
                <div key={i} className={`flex-1 border-r-2 border-pink-100/50 last:border-r-0 relative group transition-colors duration-100 ${activeLanes[i] ? 'bg-pink-100/50' : ''}`}>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-pink-50/10 to-pink-200/40"></div>
                </div>
            ))}

            {/* JUDGMENT ZONE (Hit Line) */}
            <div 
                className="absolute w-full h-12 border-y-4 border-pink-400/50 bg-pink-300/20 z-0 flex items-center justify-center" 
                style={{ top: `${HIT_ZONE_Y}%`, transform: 'translateY(-50%)' }}
            >
                <div className={`w-full h-1 ${isFever ? 'bg-yellow-400 shadow-[0_0_20px_gold]' : 'bg-pink-400/80 shadow-[0_0_20px_rgba(244,114,182,1)]'} animate-pulse`}></div>
            </div>
            
            {/* Notes Rendering */}
            {notes.map(note => {
                if (note.hit) return null;
                
                const currentTime = getAudioTime();
                const timeUntilHit = note.targetTime - currentTime;
                // In Fever, visually speed up (cheat by mapping progress differently or just leave strictly time based)
                // Since user complained about sync, stick to strict time based.
                // Illusion of speed can be done by background moving.
                const progress = 1 - (timeUntilHit / APPROACH_TIME);
                
                const topY = -10;
                const y = topY + (progress * (HIT_ZONE_Y - topY));

                return (
                <div
                    key={note.id}
                    className="absolute w-1/3 flex justify-center items-center pointer-events-none will-change-transform"
                    style={{
                    left: `${note.lane * 33.33}%`,
                    top: `${y}%`, 
                    height: '0px',
                    transform: 'translateY(-50%)',
                    opacity: note.missed ? 0.5 : 1,
                    filter: note.missed ? 'grayscale(100%)' : 'none'
                    }}
                >
                    <div className="text-6xl drop-shadow-xl relative transform transition-transform">
                     {currentCow.emoji}
                    </div>
                </div>
                );
            })}
            
            {/* Feedback Overlay */}
            {feedback && (
                <div className="absolute top-[70%] left-0 w-full flex justify-center items-center z-50 pointer-events-none">
                <div className="relative animate-bounce-in">
                    <div className={`text-6xl font-black ${feedback.color} stroke-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)]`} style={{WebkitTextStroke: '2px white'}}>
                        {feedback.text}
                    </div>
                </div>
                </div>
            )}
            </div>
        </div>
      )}

      {/* Controls */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white via-white/90 to-transparent z-40">
        <div className="flex justify-center gap-4 max-w-lg mx-auto">
          {[0, 1, 2].map(lane => (
            <button
              key={lane}
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border-b-8 transition-all shadow-xl flex items-center justify-center relative overflow-hidden ring-4 ${currentDrum.ring} ${currentDrum.color} ${gamePhase === 'BOSS' ? 'border-red-600 bg-red-400 ring-red-200 animate-pulse' : 'border-pink-500'} ${activeLanes[lane] ? 'translate-y-2 brightness-90' : ''}`}
              onTouchStart={(e) => { e.preventDefault(); handleLanePress(lane); }}
              onMouseDown={(e) => { e.preventDefault(); handleLanePress(lane); }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 {gamePhase === 'BOSS' ? (
                     <span className="text-4xl font-black text-white">👊</span>
                 ) : (
                    <>
                        {/* Ears */}
                        <div className={`absolute -top-2 -left-2 w-8 h-8 rounded-full ${currentDrum.id === 'gold' ? 'bg-yellow-600' : 'bg-pink-400'}`}></div>
                        <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full ${currentDrum.id === 'gold' ? 'bg-yellow-600' : 'bg-pink-400'}`}></div>
                        {/* Snout */}
                        <div className={`w-14 h-10 rounded-[50%] flex justify-center items-center gap-2 shadow-inner transition-transform ${activeLanes[lane] ? 'scale-90' : ''} ${currentDrum.id === 'gold' ? 'bg-yellow-500' : 'bg-pink-400'}`}>
                            <div className="w-3 h-4 bg-pink-800 rounded-full opacity-50"></div>
                            <div className="w-3 h-4 bg-pink-800 rounded-full opacity-50"></div>
                        </div>
                        {currentDrum.id === 'gold' && <div className="absolute -bottom-2 text-2xl">👑</div>}
                    </>
                 )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Start Screen */}
      {!isPlaying && !gameOver && (
        <div className="absolute inset-0 z-50 bg-pink-500/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm border-8 border-pink-200 animate-pop-in transform rotate-1">
              <div className="flex justify-center gap-4 mb-4 text-6xl">
                 <span>{currentCow.emoji}</span><span>🎵</span><span>{currentDrum.emoji}</span>
              </div>
              <h1 className="text-4xl font-black text-pink-600 mb-2">快樂農場進行曲</h1>
              <div className="bg-pink-50 rounded-xl p-4 mb-6 text-gray-600 font-bold leading-relaxed text-sm text-left">
                <p>1. 節奏打擊 (120 BPM)</p>
                <p>2. <span className="text-purple-600">Fever模式</span>：10連擊觸發分數加倍！</p>
                <p>3. <span className="text-red-600">BOSS戰</span>：音樂結束前狂點攻擊豬王！</p>
                <p className="mt-2 text-xs text-gray-400">目前解鎖: {currentCow.name}</p>
              </div>
              <button 
                onClick={() => { setIsPlaying(true); setLives(MAX_LIVES); setScore(0); setGamePhase('PLAYING'); }}
                className="bg-green-400 hover:bg-green-500 text-white text-2xl font-black py-4 px-12 rounded-full shadow-lg transform transition active:scale-95 border-b-8 border-green-600 w-full group"
              >
                <span className="group-hover:animate-pulse inline-block">▶️</span> 音樂開始!
              </button>
           </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm border-8 border-gray-200 animate-bounce-in">
              <div className="text-6xl mb-4">{bossHealth <= 0 ? '🏆' : '💀'}</div>
              <h2 className="text-4xl font-black text-gray-700 mb-2">{bossHealth <= 0 ? '大勝利！' : '挑戰失敗'}</h2>
              <div className="my-6">
                 <div className="text-gray-500 font-bold uppercase text-sm">Final Score</div>
                 <div className="text-6xl font-black text-pink-600">{score}</div>
                 {bossHealth <= 0 && <div className="text-green-500 font-bold mt-2">BOSS擊破獎勵 +1000!</div>}
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