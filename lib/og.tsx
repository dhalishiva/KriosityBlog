// Shared Open Graph artwork.
export const ogSize = { width: 1200, height: 630 };

export function Gem({ size = 360, highlight }: { size?: number; highlight?: string }) {
  const facets: [string, string][] = [
    ["250,28 112,148 176,176", "rgba(201,218,254,0.9)"],
    ["250,28 176,176 250,206", "rgba(201,218,254,0.75)"],
    ["250,28 250,206 324,176", "rgba(201,218,254,0.6)"],
    ["250,28 324,176 388,148", "rgba(201,218,254,0.45)"],
    ["112,148 38,250 148,266 176,176", "#14213D"],
    ["176,176 148,266 250,274 250,206", "#0377B5"],
    ["250,206 250,274 352,266 324,176", "#2B50FF"],
    ["324,176 352,266 462,250 388,148", "rgba(201,218,254,0.35)"],
    ["38,250 148,266 250,548", "#0F7B6C"],
    ["148,266 250,274 250,548", "#C2362B"],
    ["250,274 352,266 250,548", "#4A51DC"],
    ["352,266 462,250 250,548", "#2C64F0"],
  ];
  return (
    <svg width={size} height={(size * 580) / 500} viewBox="0 0 500 580">
      {facets.map(([pts, fill], i) => (
        <polygon key={i} points={pts} fill={highlight && fill.startsWith("#") && fill !== highlight ? "rgba(255,255,255,0.12)" : fill} stroke="#14203a" strokeWidth="3" />
      ))}
    </svg>
  );
}

// Small Kriosity mark (same as the site logo) for the top-left of share images.
export function Mark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <polygon points="16,1 6,11 16,13" fill="#0377B5" />
      <polygon points="16,1 26,11 16,13" fill="#4A51DC" />
      <polygon points="6,11 16,13 16,31" fill="#C2362B" />
      <polygon points="26,11 16,13 16,31" fill="#0F7B6C" />
      <polygon points="6,11 16,31 3,14" fill="#9DB8F7" />
      <polygon points="26,11 16,31 29,14" fill="#2C64F0" />
    </svg>
  );
}
