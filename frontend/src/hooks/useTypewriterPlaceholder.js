import { useEffect, useState } from 'react';

// Cycles through example phrases, typing/deleting one character at a time,
// for use as an input's placeholder while it's empty and not focused/active.
export const useTypewriterPlaceholder = (phrases, paused = false) => {
  const [typedPlaceholder, setTypedPlaceholder] = useState('');

  useEffect(() => {
    if (paused || !phrases?.length) return undefined;
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId;

    const tick = () => {
      const phrase = phrases[phraseIndex];
      if (!deleting) {
        charIndex += 1;
        setTypedPlaceholder(`${phrase.slice(0, charIndex)}▎`);
        if (charIndex === phrase.length) {
          deleting = true;
          setTypedPlaceholder(phrase);
          timeoutId = setTimeout(tick, 1500);
          return;
        }
        timeoutId = setTimeout(tick, 45);
      } else {
        charIndex -= 1;
        setTypedPlaceholder(`${phrase.slice(0, charIndex)}▎`);
        if (charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timeoutId = setTimeout(tick, 400);
          return;
        }
        timeoutId = setTimeout(tick, 22);
      }
    };
    timeoutId = setTimeout(tick, 45);
    return () => clearTimeout(timeoutId);
  }, [phrases, paused]);

  return typedPlaceholder;
};
