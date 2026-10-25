// Text-to-speech via the Web Speech API (no network needed on most devices).
(function () {
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let voice = null;

  function pickVoice() {
    if (!supported) return;
    const voices = speechSynthesis.getVoices();
    voice = voices.find(v => v.lang === 'en-US' && /Google|Samantha|Aria|Jenny|Microsoft/i.test(v.name))
      || voices.find(v => v.lang === 'en-US')
      || voices.find(v => /^en/i.test(v.lang))
      || null;
  }

  if (supported) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text, rate = 0.9) {
    if (!supported || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  window.Speech = { speak, supported };
})();
