import { ImageResponse } from "next/og";
import { Gem, Mark, ogSize } from "@/lib/og";

export const alt = "Kriosity Blog — AI, tested and explained";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#14203a", padding: "70px 80px", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Mark size={46} />
            <div style={{ fontSize: 38, color: "#ffffff", fontWeight: 700, letterSpacing: -1 }}>kriosity</div>
            <div style={{ fontSize: 30, color: "#c9dafe", marginLeft: 6, paddingLeft: 16, borderLeft: "2px solid rgba(201,218,254,0.5)" }}>blog</div>
          </div>
          <div style={{ fontSize: 76, color: "#fff", fontWeight: 800, lineHeight: 1.02, letterSpacing: -2.5, marginTop: 40 }}>AI, tested and explained.</div>
          <div style={{ fontSize: 28, color: "rgba(255,255,255,0.7)", marginTop: 28 }}>New models, honest comparisons, every source listed.</div>
        </div>
        <Gem size={320} />
      </div>
    ),
    size,
  );
}
