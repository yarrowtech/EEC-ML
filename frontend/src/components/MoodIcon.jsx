import React, { useState } from "react";

// Mood emoji drawn as an image (Twemoji), so it looks the same on every device —
// some phones/PCs have no colour-emoji font and show empty boxes instead.
// Falls back to the native emoji character if the image can't load.
const TWEMOJI_BASE = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";

// "😊" -> "1f60a" (Twemoji file name; variation selector FE0F dropped)
const codepointsOf = (emoji) => Array.from(String(emoji || ""))
  .map((ch) => ch.codePointAt(0))
  .filter((cp) => cp !== 0xfe0f)
  .map((cp) => cp.toString(16))
  .join("-");

const MoodIcon = ({ emoji, label = "", size = 18, className = "" }) => {
  const [failed, setFailed] = useState(false);
  const code = codepointsOf(emoji);
  if (!code || failed) {
    return <span role="img" aria-label={label} className={className} style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span>;
  }
  return (
    <img
      src={`${TWEMOJI_BASE}/${code}.svg`}
      alt={label}
      title={label || undefined}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={`inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export default MoodIcon;
