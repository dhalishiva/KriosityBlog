// Same mark and wordmark as kriosity.in (repo dhalishiva/kriosity, components/Logo.tsx).
// Keep the two in sync.
export function Mark({ size = 28 }: { size?: number }) {
  // A faceted crystal: each facet carries one product colour.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flexShrink: 0 }}>
      <polygon points="16,1 6,11 16,13" fill="#0377B5" />
      <polygon points="16,1 26,11 16,13" fill="#4A51DC" />
      <polygon points="6,11 16,13 16,31" fill="#C2362B" />
      <polygon points="26,11 16,13 16,31" fill="#0F7B6C" />
      <polygon points="6,11 16,31 3,14" fill="#9DB8F7" />
      <polygon points="26,11 16,31 29,14" fill="#2C64F0" />
    </svg>
  );
}

export default function Logo({ light = false, size = 28, suffix }: { light?: boolean; size?: number; suffix?: string }) {
  return (
    <span className="k-logo" style={{ color: light ? "#fff" : "var(--ink)" }}>
      <Mark size={size} />
      <span className="k-word" style={{ fontSize: `${(size / 28) * 1.45}rem` }}>kriosity</span>
      {suffix && <span className="k-suffix">{suffix}</span>}
    </span>
  );
}
