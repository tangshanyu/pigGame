
let audioCtx: AudioContext | null = null;
let bgmNodes: AudioScheduledSourceNode[] = [];
let nextNoteTime = 0;
let isPlayingBgm = false;
let timerID: number | null = null;
let startTime = 0; // Track when music started for sync

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

// 120 BPM March
export const BPM = 120;
const SECONDS_PER_BEAT = 60.0 / BPM;
const LOOKAHEAD = 25.0; // ms
const SCHEDULE_AHEAD_TIME = 0.1; // s

// "March of the Piglets" - Energetic & Staccato
const MELODY_SEQUENCE = [
  // 1
  { note: 'C4', len: 0.5 }, { note: 'G3', len: 0.5 }, { note: 'C4', len: 0.5 }, { note: 'G3', len: 0.5 },
  { note: 'E4', len: 0.5 }, { note: 'C4', len: 0.5 }, { note: 'E4', len: 1.0 },
  // 2
  { note: 'D4', len: 0.5 }, { note: 'G3', len: 0.5 }, { note: 'D4', len: 0.5 }, { note: 'G3', len: 0.5 },
  { note: 'D4', len: 0.5 }, { note: 'E4', len: 0.5 }, { note: 'F4', len: 1.0 },
  // 3
  { note: 'G4', len: 0.5 }, { note: 'E4', len: 0.5 }, { note: 'F4', len: 0.5 }, { note: 'D4', len: 0.5 },
  { note: 'E4', len: 0.5 }, { note: 'C4', len: 0.5 }, { note: 'D4', len: 1.0 },
  // 4
  { note: 'C4', len: 1.0 }, { note: 'G3', len: 0.5 }, { note: 'G3', len: 0.5 },
  { note: 'C4', len: 1.0 }, { note: null, len: 1.0 },
];

const BASS_SEQUENCE = [
  // Marching Bass (Root - Fifth)
  { freq: 130.81, len: 1 }, // C3
  { freq: 196.00, len: 1 }, // G3
  { freq: 130.81, len: 1 }, // C3
  { freq: 196.00, len: 1 }, // G3
];

let currentBeatIndex = 0;
let currentSubBeatIndex = 0; // For melody (eighth notes)

const NOTES = {
  'G3': 196.00,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25,
};

const playOscillator = (freq: number, time: number, duration: number, type: 'square' | 'triangle' | 'sine', vol: number) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(vol, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration - 0.01);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start(time);
  osc.stop(time + duration);
  
  bgmNodes.push(osc);
  bgmNodes.push(gain as any);
};

const playKick = (time: number) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  // Punchy Kick
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);
  
  gain.gain.setValueAtTime(0.8, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start(time);
  osc.stop(time + 0.3);
  bgmNodes.push(osc);
  bgmNodes.push(gain as any);
};

const playSnare = (time: number) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  // Noise-ish snare (using high triangle with fast decay as placeholder)
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(400, time);
  osc.frequency.linearRampToValueAtTime(100, time + 0.1);
  
  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start(time);
  osc.stop(time + 0.1);
  bgmNodes.push(osc);
  bgmNodes.push(gain as any);
};

const scheduler = () => {
  if (!audioCtx) return;
  
  while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD_TIME) {
    // 1. Rhythm Section (Kick on 1, 3; Snare on 2, 4 usually, but let's do March: Kick on all beats)
    playKick(nextNoteTime);
    if (currentBeatIndex % 2 === 1) {
       // Accent on off-beats slightly
       playSnare(nextNoteTime);
    }

    // 2. Bass (Quarter notes)
    const bassNote = BASS_SEQUENCE[currentBeatIndex % BASS_SEQUENCE.length];
    playOscillator(bassNote.freq, nextNoteTime, SECONDS_PER_BEAT * 0.6, 'triangle', 0.2);

    // 3. Melody (Eighth notes mapping)
    // We play 2 melody notes per beat logic for simplicity in this loop
    // Note: MELODY_SEQUENCE is roughly based on 0.5 beat steps.
    // Let's iterate melody based on half-beats.
    
    // Actually, to keep it simple, let's just play melody notes that align with this beat?
    // The previous implementation was a bit rigid. Let's rely on `currentSubBeatIndex`.
    // But `scheduler` runs every `timer`.
    // Let's just play the notes scheduled for this `nextNoteTime`.
    
    // IMPORTANT: The scheduler loop advances by 1 BEAT (SECONDS_PER_BEAT).
    // So we need to schedule 2 eighth notes.
    
    const note1 = MELODY_SEQUENCE[currentSubBeatIndex % MELODY_SEQUENCE.length];
    const time1 = nextNoteTime;
    if (note1 && note1.note) {
        playOscillator(NOTES[note1.note as keyof typeof NOTES], time1, note1.len * SECONDS_PER_BEAT * 0.9, 'square', 0.15);
    }
    
    const note2 = MELODY_SEQUENCE[(currentSubBeatIndex + 1) % MELODY_SEQUENCE.length];
    const time2 = nextNoteTime + (SECONDS_PER_BEAT / 2); // The 'and' count
    if (note2 && note2.note) {
        // Only schedule if it fits before next beat? No, schedule it now.
         playOscillator(NOTES[note2.note as keyof typeof NOTES], time2, note2.len * SECONDS_PER_BEAT * 0.9, 'square', 0.15);
    }
    
    currentSubBeatIndex += 2;

    // Advance
    nextNoteTime += SECONDS_PER_BEAT;
    currentBeatIndex++;
  }
  
  if (isPlayingBgm) {
    timerID = window.setTimeout(scheduler, LOOKAHEAD);
  }
};

export const startFarmBGM = async () => {
  const ctx = getAudioContext();
  if (!ctx) return 0;
  
  if (ctx.state === 'suspended') await ctx.resume();

  if (isPlayingBgm) return startTime;
  
  isPlayingBgm = true;
  currentBeatIndex = 0;
  currentSubBeatIndex = 0;
  // Start slightly in the future to allow setup
  startTime = ctx.currentTime + 0.1;
  nextNoteTime = startTime;
  
  scheduler();
  return startTime;
};

// Return the current audio time for precise syncing
export const getAudioTime = () => {
  if (!audioCtx) return 0;
  return audioCtx.currentTime;
};

export const stopBGM = () => {
  isPlayingBgm = false;
  if (timerID) clearTimeout(timerID);
  
  bgmNodes.forEach(node => {
    try {
      node.stop();
      node.disconnect();
    } catch (e) {}
  });
  bgmNodes = [];
};

export const playSound = (type: 'MOO' | 'SQUEAL' | 'RHYTHM_HIT' | 'RHYTHM_MISS' | 'BOSS_HIT' | 'UNLOCK' | 'BOSS_DEFEATED') => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const t = ctx.currentTime;

  if (type === 'MOO') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'triangle'; 
    osc.frequency.setValueAtTime(280, t); 
    osc.frequency.linearRampToValueAtTime(220, t + 0.3); 
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.linearRampToValueAtTime(400, t + 0.3);
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);

  } else if (type === 'SQUEAL') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine'; 
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(1600, t + 0.05); 
    osc.frequency.linearRampToValueAtTime(800, t + 0.15); 
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  } else if (type === 'RHYTHM_HIT') {
    // Cute Pig Drum (High Pitch Kick + Squeak)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.15);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
    
    // Oink
    const oinkOsc = ctx.createOscillator();
    const oinkGain = ctx.createGain();
    oinkOsc.type = 'sawtooth';
    oinkOsc.frequency.setValueAtTime(500, t);
    oinkOsc.frequency.linearRampToValueAtTime(700, t + 0.05);
    oinkGain.gain.setValueAtTime(0.2, t);
    oinkGain.gain.linearRampToValueAtTime(0, t + 0.08);
    oinkOsc.connect(oinkGain);
    oinkGain.connect(ctx.destination);
    oinkOsc.start(t);
    oinkOsc.stop(t + 0.08);

  } else if (type === 'RHYTHM_MISS') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.linearRampToValueAtTime(50, t + 0.2);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  } else if (type === 'BOSS_HIT') {
    // Heavy Hit
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  } else if (type === 'UNLOCK') {
    // Chime
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, t); // C5
    osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, t + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, t + 0.3); // C6
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.0);
  } else if (type === 'BOSS_DEFEATED') {
    // Explosionish
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
    noise.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
  }
};
