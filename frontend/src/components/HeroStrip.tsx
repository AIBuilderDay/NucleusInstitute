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
      className="bg-nucleus-blue text-blue-50 border-b border-blue-700"
    >
      <div
        className={`max-w-[1440px] mx-auto px-32 grid gap-48 items-center ${
          dense ? "py-36 min-h-[196px]" : "py-56 min-h-[280px]"
        } ${side ? "grid-cols-[1fr_380px]" : "grid-cols-1"}`}
      >
        <div>
          <div className="tiny-caps text-gold-faint">
            {eyebrow}
          </div>
          <h1
            className={`font-display font-normal my-0 mt-10 mb-14 max-w-[760px] text-blue-50 leading-[1.12] ${
              dense ? "text-[38px]" : "text-[56px]"
            }`}
          >
            {title}
          </h1>
          {lede && (
            <p
              className="m-0 text-[16px] leading-[1.55] text-[rgba(240,232,214,0.78)] max-w-[620px]"
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
