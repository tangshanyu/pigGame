
export const playSound = (type: 'MOO' | 'SQUEAL') => {
  if (!window.speechSynthesis) return;

  // Cancel previous sounds to prevent lag/buildup
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance();
  
  if (type === 'MOO') {
    utterance.text = "Moo";
    utterance.pitch = 0.5; // Deep voice
    utterance.rate = 0.8;  // Slow
    utterance.volume = 0.5;
  } else if (type === 'SQUEAL') {
    // Randomize squeal slightly for variety
    const sounds = ["Oink", "Wee", "Eek"];
    utterance.text = sounds[Math.floor(Math.random() * sounds.length)];
    utterance.pitch = 1.8; // High pitched
    utterance.rate = 1.5;  // Fast
    utterance.volume = 1.0;
  }

  // Select a voice if possible (English usually sounds better for "Moo/Oink")
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en'));
  if (enVoice) utterance.voice = enVoice;

  window.speechSynthesis.speak(utterance);
};
