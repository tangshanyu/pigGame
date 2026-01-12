
let audioCtx: AudioContext | null = null;
let bgmNodes: AudioScheduledSourceNode[] = [];
let nextNoteTime = 0;
let isPlayingBgm = false;
let timerID: number | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

// Peppa Pig Theme Tempo
// Sheet says 82, but for a game 100 feels more energetic and fun
const TEMPO = 100; 
const LOOKAHEAD = 25.0; // ms
const SCHEDULE_AHEAD_TIME = 0.1; // s

const NOTES = {
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F#5': 739.99, 'G5': 783.99
};

// Transcription of Peppa Pig Theme based on the provided sheet (Key: G Major)
const MELODY = [
  // "可愛的佩佩" (G E G E)
  { note: 'G4', len: 0.5 }, { note: 'E4', len: 0.5 }, 
  { note: 'G4', len: 0.5 }, { note: 'E4', len: 0.5 },
  
  // "大家的好朋友" (C G E C)
  { note: 'C5', len: 0.5 }, { note: 'G4', len: 0.5 }, 
  { note: 'E4', len: 0.5 }, { note: 'C4', len: 0.5 },
  
  // "可愛的" (F# A) "佩佩" (C -)
  { note: 'F#4', len: 0.5 }, { note: 'A4', len: 0.5 }, 
  { note: 'C5', len: 1.0 },
  
  // "佩佩" (B A G -) - Ending phrase of the loop
  { note: 'B4', len: 0.5 }, { note: 'A4', len: 0.5 }, 
  { note: 'G4', len: 1.5 },
  
  // Small pause/breath before loop
  { note: null, len: 0.5 }
];

let currentNoteIndex = 0;

const scheduleNote = (noteFreq: number, time: number, length: number) => {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // Use triangle wave for a playful, flute-like synth sound
  osc.type = 'triangle';
  osc.frequency.value = noteFreq;

  // Envelope (Bouncy Staccato)
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.2, time + 0.05); // Attack
  gain.gain.exponentialRampToValueAtTime(0.01, time + length - 0.05); // Decay

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start(time);
  osc.stop(time + length);
  
  bgmNodes.push(osc);
  bgmNodes.push(gain as any);
};

const scheduler = () => {
  if (!audioCtx) return;
  while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD_TIME) {
    const noteData = MELODY[currentNoteIndex];
    if (noteData.note) {
      scheduleNote(NOTES[noteData.note as keyof typeof NOTES], nextNoteTime, noteData.len * (60 / TEMPO));
    }
    nextNoteTime += noteData.len * (60 / TEMPO);
    currentNoteIndex = (currentNoteIndex + 1) % MELODY.length;
  }
  if (isPlayingBgm) {
    timerID = window.setTimeout(scheduler, LOOKAHEAD);
  }
};

export const startPeppaBGM = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  if (ctx.state === 'suspended') ctx.resume();

  if (isPlayingBgm) return;
  
  isPlayingBgm = true;
  currentNoteIndex = 0;
  nextNoteTime = ctx.currentTime + 0.1;
  scheduler();
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

export const playSound = (type: 'MOO' | 'SQUEAL' | 'RHYTHM_HIT' | 'RHYTHM_MISS') => {
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
    // Piggy Drum Sound: A mix of a low thud (drum) and a high squeak (pig)
    
    // 1. Drum Thud (Low Sine/Triangle)
    const oscDrum = ctx.createOscillator();
    const gainDrum = ctx.createGain();
    oscDrum.type = 'triangle';
    oscDrum.frequency.setValueAtTime(150, t);
    oscDrum.frequency.exponentialRampToValueAtTime(0.01, t + 0.3);
    gainDrum.gain.setValueAtTime(0.5, t);
    gainDrum.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    oscDrum.connect(gainDrum);
    gainDrum.connect(ctx.destination);
    oscDrum.start(t);
    oscDrum.stop(t + 0.3);

    // 2. Short Pig Squeak (High Sine Sweep)
    const oscSqueak = ctx.createOscillator();
    const gainSqueak = ctx.createGain();
    oscSqueak.type = 'sine';
    oscSqueak.frequency.setValueAtTime(600, t);
    oscSqueak.frequency.linearRampToValueAtTime(900, t + 0.1);
    gainSqueak.gain.setValueAtTime(0.2, t);
    gainSqueak.gain.linearRampToValueAtTime(0, t + 0.15);
    oscSqueak.connect(gainSqueak);
    gainSqueak.connect(ctx.destination);
    oscSqueak.start(t);
    oscSqueak.stop(t + 0.15);

  } else if (type === 'RHYTHM_MISS') {
    // Low Thud / Error sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.linearRampToValueAtTime(40, t + 0.3);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }
};
