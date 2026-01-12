
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    // Handle cross-browser AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

export const playSound = (type: 'MOO' | 'SQUEAL') => {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  // Ensure context is running
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const t = ctx.currentTime;

  if (type === 'MOO') {
    // 可愛小牛 (Baby Cow): 較高音、較短促、使用三角波比較圓潤
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle'; // 三角波比鋸齒波更柔和
    osc.frequency.setValueAtTime(280, t); // 起始頻率較高
    osc.frequency.linearRampToValueAtTime(220, t + 0.3); // 微微下降

    // 濾波器模擬嘴巴
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.linearRampToValueAtTime(400, t + 0.3);

    // 音量包絡 (短促)
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
    // 橡皮鴨叫聲 (Rubber Duck Squeak): 極短的 Sine 波掃頻
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine'; // 正弦波最像玩具聲
    
    // 快速的 "啾!" (頻率上揚再下降)
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(1600, t + 0.05); // 快速衝高
    osc.frequency.linearRampToValueAtTime(800, t + 0.15);  // 回落

    // 音量極短
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  }
};
