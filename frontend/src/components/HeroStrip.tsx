import type { ReactNode } from "react";

interface HeroStripProps {
  eyebrow: string;
  title: string;
  lede?: string;
  side?: ReactNode;
  dense?: boolean;
}

export function HeroStrip({ eyebrow, title, lede, side = null, dense = false }: HeroStripProps) {
  return (
    <section
      style={{
        background: "var(--nucleus-blue)",
        color: "var(--wasatch-whisper)",
        borderBottom: "1px solid var(--nucleus-blue-600)",
      }}
    >
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: dense ? "36px 32px 36px" : "56px 32px 56px",
          minHeight: dense ? 196 : 280,
          display: "grid",
          gridTemplateColumns: side ? "1fr 380px" : "1fr",
          gap: 48,
          alignItems: "center",
        }}
      >
        <div>
          <div className="tiny-caps" style={{ color: "var(--copper-soft)" }}>
            {eyebrow}
          </div>
          <h1
            className="display"
            style={{
              fontSize: dense ? 38 : 56,
              fontWeight: 400,
              margin: "10px 0 14px",
              maxWidth: 760,
              color: "var(--wasatch-whisper)",
              lineHeight: 1.12,
            }}
          >
            {title}
          </h1>
          {lede && (
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.55,
                color: "rgba(240,232,214,0.78)",
                maxWidth: 620,
              }}
            >
              {lede}
            </p>
          )}
        </div>
        {side && <div>{side}</div>}
      </div>
    </section>
  );
}
