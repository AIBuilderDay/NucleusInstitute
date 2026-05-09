import { useEffect, useRef } from "react";
import { IUMonogram } from "../components/ui";

interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white overflow-hidden">
      <PublicNav onEnter={onEnter} />

      {/* Hero */}
      <section className="max-w-[1240px] mx-auto px-32 pt-80 pb-96 grid grid-cols-[repeat(auto-fit,minmax(420px,1fr))] gap-64 items-center">
        <div className="min-w-0">
          <div className="font-mono inline-flex items-center gap-8 px-12 py-6 rounded-full bg-blue-50 text-blue-700 text-[11px] uppercase tracking-[1.5px] mb-24">
            <span className="w-6 h-6 rounded-full bg-nucleus-blue" />
            Wasatch Front · invite-only
          </div>
          <h1 className="font-display text-[68px] font-normal leading-[1.05] tracking-[-1px] text-graphite mb-24">
            Utah's talent <em className="italic font-light">and</em> startups,
            connected with intent.
          </h1>
          <p className="text-[17px] text-graphite-muted leading-[1.55] max-w-[540px] mb-32">
            Nucleus is a curated network for Utah-built companies — operators, advisors, investors,
            and students introduced through transparent, rule-based matching. No pay-to-pitch. No
            spray-and-pray.
          </p>
          <div className="flex gap-12 flex-wrap">
            <button
              className="btn btn-primary px-24 py-14 text-[15px] h-48"
              onClick={onEnter}
            >
              Request access
              <ArrowIcon />
            </button>
            <button
              className="btn btn-ghost px-24 py-14 text-[15px] h-48"
              onClick={onEnter}
            >
              Sign in
            </button>
          </div>
          <div className="flex gap-28 mt-40 flex-wrap">
            <HeroStat num="340+" label="Verified members" />
            <HeroStat num="62" label="Startups raising" />
            <HeroStat num="$48M" label="Routed in 2025" />
          </div>
        </div>

        <div className="min-w-0 flex justify-center">
          <Constellation />
        </div>
      </section>

      {/* Partner carousel */}
      <UtahCarousel />

      {/* Three pillars */}
      <section className="max-w-[1240px] mx-auto py-96 px-32">
        <div className="flex justify-between items-end mb-48 gap-32 flex-wrap">
          <div className="max-w-[560px]">
            <div className="font-mono text-[11px] uppercase tracking-[1.5px] text-graphite-muted mb-12">
              What you get
            </div>
            <h2 className="font-display text-[44px] font-normal leading-[1.05] tracking-[-0.5px] text-graphite">
              Three loops, one network.
            </h2>
          </div>
          <p className="text-[15px] text-graphite-muted max-w-[360px] leading-[1.55]">
            Each loop solves a specific introduction failure. Together they form an honest workflow
            that respects everyone's time.
          </p>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-1 bg-pearl-300 border border-pearl-300 rounded-[12px] overflow-hidden">
          <Pillar
            num="01"
            title="Explore"
            body="Hand-curated profiles of Utah operators, advisors, investors, and startups. Pass or save — saved profiles enter your weekly digest."
            tag="One card at a time"
          />
          <Pillar
            num="02"
            title="Match"
            body="Configure who you're matching for. Our rule-based engine ranks candidates and shows the reasoning behind every score — no black box."
            tag="Explainable scoring"
          />
          <Pillar
            num="03"
            title="Connect"
            body="When both sides save each other, we route a warm introduction with shared context. No cold inboxes, no orphaned messages."
            tag="Mutual interest only"
          />
        </div>
      </section>

      {/* Seven dimensions — dark section */}
      <section className="bg-graphite text-white py-96 px-32 relative overflow-hidden">
        <div className="max-w-[1240px] mx-auto relative z-1">
          <div className="font-mono text-[11px] uppercase tracking-[1.5px] text-[rgba(255,255,255,0.5)] mb-12">
            How matches happen
          </div>
          <h2 className="font-display text-[44px] font-normal leading-[1.05] tracking-[-0.5px] text-white mb-56 max-w-[720px]">
            We score on seven dimensions. You see all of them.
          </h2>

          <DimensionCards />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1240px] mx-auto py-96 px-32">
        <div
          className="p-56 border border-pearl-300 rounded-[16px] flex justify-between items-center gap-32 flex-wrap bg-[linear-gradient(135deg,var(--blue-50)_0%,white_60%)]"
        >
          <div className="max-w-[600px]">
            <h2 className="font-display text-[40px] font-normal leading-[1.05] tracking-[-0.5px] text-graphite mb-12">
              Built in Utah, for Utah.
            </h2>
            <p className="text-[15px] text-graphite-muted leading-[1.55] m-0">
              Membership is free for verified Utah residents and Utah-based companies. We invite-vet
              every profile. Get on the list.
            </p>
          </div>
          <div className="flex gap-12 flex-wrap">
            <button
              className="btn btn-primary px-24 py-14 text-[15px] h-48"
              onClick={onEnter}
            >
              Request access
              <ArrowIcon />
            </button>
            <button
              className="btn btn-ghost px-24 py-14 text-[15px] h-48"
              onClick={onEnter}
            >
              I have an account
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-pearl-300 py-48 px-32 bg-pearl">
        <div className="max-w-[1240px] mx-auto grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-32">
          <div>
            <div className="flex items-center gap-10">
              <NucleusLogo />
            </div>
            <p className="text-[12px] text-graphite-muted mt-16 leading-[1.5] max-w-[220px]">
              A talent + capital network for Utah-built companies. Wasatch Front · est. 2024.
            </p>
          </div>
          <FooterCol title="Product" links={["Explore", "Match", "Profile", "Trust badges"]} />
          <FooterCol
            title="Network"
            links={["For talent", "For startups", "For investors", "Universities"]}
          />
          <FooterCol title="Company" links={["About", "Privacy", "Code of conduct", "Contact"]} />
        </div>
      </footer>
    </div>
  );
}

const DIMENSIONS = [
  ["Role", "Title and category fit between seeker and target."],
  ["Sector", "Industry overlap, primary and secondary."],
  ["Stage", "Founder/operator stage preference vs. company stage."],
  ["Skills", "Required skills covered by the candidate's profile."],
  ["Mission", "Shared keywords — what people care about."],
  ["Location", "Wasatch Front proximity and remote tolerance."],
  ["Risk", "Comfort with pre-seed vs. growth-stage stability."],
] as const;

function DimensionCards() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>(".card-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-24"
    >
      {DIMENSIONS.map(([label, body], i) => (
        <div
          key={label}
          className="card-reveal p-24 border border-[rgba(255,255,255,0.12)] rounded-[8px] bg-[rgba(255,255,255,0.02)]"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-[rgba(255,255,255,0.5)] mb-10">
            {label}
          </div>
          <div className="text-[14px] text-[rgba(255,255,255,0.85)] leading-[1.6]">
            {body}
          </div>
        </div>
      ))}
      <div
        className="card-reveal p-24 rounded-[8px] bg-nucleus-blue flex flex-col justify-between"
        style={{ animationDelay: `${DIMENSIONS.length * 100}ms` }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-[rgba(255,255,255,0.7)] mb-10">
          Result
        </div>
        <div className="font-display text-[36px] text-white leading-none">
          One score.
        </div>
        <div className="text-[13px] text-[rgba(255,255,255,0.85)] mt-8">
          With every reason, every blocker, fully transparent.
        </div>
      </div>
    </div>
  );
}

function PublicNav({ onEnter }: { onEnter: () => void }) {
  return (
    <header
      className="sticky top-0 z-50 bg-[rgba(255,255,255,0.92)] border-b border-pearl-300 backdrop-blur-[8px] backdrop-saturate-[180%]"
    >
      <div className="max-w-[1240px] mx-auto px-32 h-68 flex items-center justify-between">
        <NucleusLogo />
        <nav className="flex gap-8 items-center">
          <NavLink>How it works</NavLink>
          <NavLink>For startups</NavLink>
          <NavLink>For talent</NavLink>
          <div className="w-12" />
          <button
            className="btn btn-ghost px-14 py-8 text-[13px]"
            onClick={onEnter}
          >
            Sign in
          </button>
          <button
            className="btn btn-primary px-14 py-8 text-[13px]"
            onClick={onEnter}
          >
            Request access
          </button>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="px-14 py-8 text-[14px] text-graphite-muted hover:text-graphite no-underline"
    >
      {children}
    </a>
  );
}

function NucleusLogo() {
  return (
    <div className="flex items-center gap-10">
      <svg width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="10" fill="none" stroke="var(--nucleus-blue)" strokeWidth="1.5" />
        <circle cx="11" cy="11" r="3.5" fill="var(--nucleus-blue)" />
        <circle
          cx="11"
          cy="11"
          r="6.5"
          fill="none"
          stroke="var(--nucleus-blue)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      </svg>
      <div className="font-display font-medium text-[18px] text-graphite tracking-[-0.2px]">
        Nucleus
      </div>
      <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-graphite-muted px-6 py-3 border border-pearl-300 rounded-[4px]">
        Institute
      </div>
    </div>
  );
}

function Pillar({
  num,
  title,
  body,
  tag,
}: {
  num: string;
  title: string;
  body: string;
  tag: string;
}) {
  return (
    <div className="bg-white p-32 flex flex-col gap-16">
      <div className="flex justify-between items-start">
        <div className="font-mono text-[11px] text-nucleus-blue tracking-[1.5px]">
          {num}
        </div>
        <span className="pill pill-blue text-[11px]">
          {tag}
        </span>
      </div>
      <h3 className="font-display text-[28px] font-normal leading-[1.05] tracking-[-0.5px] text-graphite">
        {title}
      </h3>
      <p className="text-[14px] text-graphite-muted leading-[1.6] m-0">{body}</p>
    </div>
  );
}

function HeroStat({ num, label }: { num: string; label: string }) {
  return (
    <div>
      <div className="font-display text-[32px] text-graphite leading-none font-normal">
        {num}
      </div>
      <div className="font-mono text-[10px] text-graphite-muted uppercase tracking-[1.5px] mt-6">
        {label}
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-graphite-muted mb-14">
        {title}
      </div>
      <div className="flex flex-col gap-10">
        {links.map((l) => (
          <a
            key={l}
            href="#"
            onClick={(e) => e.preventDefault()}
            className="text-[13px] text-graphite-muted no-underline"
          >
            {l}
          </a>
        ))}
      </div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3 7h8M8 3l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const UTAH_ORGS = [
  "BYU",
  "Utah State University",
  "University of Utah",
  "Podium",
  "Adobe",
  "JobNimbus",
  "nCino",
  "Remi",
  "Redo",
  "Awarco",
  "Qualtrics",
  "Pluralsight",
  "Domo",
  "Vivint",
  "Lassonde Institute",
  "Kiln",
  "BYU Cougar Capital",
] as const;

function OrgLogo({ name }: { name: string }) {
  const c = "var(--slate)";
  const s = 22;
  switch (name) {
    case "BYU":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#002E5D" />
          <text x="12" y="17" textAnchor="middle" fill="white" fontFamily="var(--font-display)" fontSize="14" fontWeight="600">Y</text>
        </svg>
      );
    case "Utah State University":
      return (
        <svg width={s + 4} height={s} viewBox="0 0 28 24" fill="none">
          <rect width="28" height="24" rx="4" fill="#0F2439" />
          <text x="14" y="16.5" textAnchor="middle" fill="white" fontFamily="var(--font-mono)" fontSize="10" fontWeight="600" letterSpacing="1">USU</text>
        </svg>
      );
    case "University of Utah":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#CC0000" />
          <text x="12" y="17" textAnchor="middle" fill="white" fontFamily="var(--font-display)" fontSize="15" fontWeight="600">U</text>
        </svg>
      );
    case "Podium":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
          <rect x="3" y="8" width="5" height="14" rx="1.5" fillOpacity="0.7" />
          <rect x="10" y="2" width="5" height="20" rx="1.5" />
          <rect x="17" y="5" width="5" height="17" rx="1.5" fillOpacity="0.85" />
        </svg>
      );
    case "Adobe":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#FF0000" />
          <path d="M5 19h4l1.5-4.5h3L15 19h4L12 5 5 19z" fill="white" />
          <path d="M10.5 14.5L12 10l1.5 4.5h-3z" fill="#FF0000" />
        </svg>
      );
    case "JobNimbus":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#1B75BC" />
          <path d="M8 7v7c0 2.2 1.8 4 4 4s4-1.8 4-4" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx="16" cy="7" r="1.5" fill="white" />
        </svg>
      );
    case "nCino":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M3 14c0-4 2-7 5-8 1.5-.5 3-.5 4 0 3 1 5 4 5 8" stroke="#00A651" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <path d="M6 14c0-2.5 1.5-5 3.5-5.5 1-.3 2-.3 3 0C14.5 9 16 11.5 16 14" stroke="#00A651" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="12" cy="14" r="2" fill="#00A651" />
        </svg>
      );
    case "Remi":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="12" fill="var(--nucleus-blue)" />
          <text x="12" y="16.5" textAnchor="middle" fill="white" fontFamily="var(--font-display)" fontSize="13" fontWeight="500">R</text>
        </svg>
      );
    case "Redo":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#6366F1" strokeWidth="2.2" fill="none" />
          <path d="M15 8l3 0 0 3" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 8c-1.5-2-4-3.5-6.5-3C8 5.5 5.5 8.5 5.5 12" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "Awarco":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#1E3A5F" />
          <text x="12" y="17" textAnchor="middle" fill="white" fontFamily="var(--font-sans)" fontSize="12" fontWeight="600">Aw</text>
        </svg>
      );
    case "Qualtrics":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#1B2B3A" />
          <text x="12" y="16.5" textAnchor="middle" fill="white" fontFamily="var(--font-mono)" fontSize="10" fontWeight="600" letterSpacing="0.5">XM</text>
        </svg>
      );
    case "Pluralsight":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#E80A89" />
          <path d="M8 5v14l10-7z" fill="white" />
        </svg>
      );
    case "Domo":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#1A1A1A" />
          <rect x="5" y="5" width="14" height="14" rx="3" fill="#FFD100" />
          <circle cx="10" cy="11" r="1.5" fill="#1A1A1A" />
          <circle cx="14" cy="11" r="1.5" fill="#1A1A1A" />
          <path d="M9.5 15c1 1 4 1 5 0" stroke="#1A1A1A" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "Vivint":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#E8E8E8" />
          <path d="M7 9l5 7 5-7" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );
    case "Lassonde Institute":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#CC0000" />
          <text x="12" y="17" textAnchor="middle" fill="white" fontFamily="var(--font-display)" fontSize="14" fontWeight="600">L</text>
        </svg>
      );
    case "Kiln":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#FF6B35" />
          <path d="M12 4c-1 3-4 5-4 9 0 3.3 1.8 6 4 7 2.2-1 4-3.7 4-7 0-4-3-6-4-9z" fill="white" />
        </svg>
      );
    case "BYU Cougar Capital":
      return (
        <svg width={s + 4} height={s} viewBox="0 0 28 24" fill="none">
          <rect width="28" height="24" rx="4" fill="#002E5D" />
          <text x="14" y="16.5" textAnchor="middle" fill="white" fontFamily="var(--font-mono)" fontSize="9" fontWeight="600" letterSpacing="0.5">CC</text>
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" fill={c} />
        </svg>
      );
  }
}

function UtahCarousel() {
  const doubled = [...UTAH_ORGS, ...UTAH_ORGS];
  return (
    <section className="border-t border-b border-pearl-300 bg-pearl py-24 overflow-hidden">
      <div className="font-mono text-center text-[10px] uppercase tracking-[2px] text-graphite-light mb-16">
        Trusted by Utah's best
      </div>
      <div className="carousel-track">
        {doubled.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="inline-flex items-center gap-10 text-[13px] font-medium text-graphite-muted whitespace-nowrap px-18 py-8 rounded-[8px] bg-white border border-pearl-300 shrink-0"
          >
            <OrgLogo name={name} />
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

function Constellation() {
  const w = 480;
  const h = 480;
  const cx = w / 2;
  const cy = h / 2;
  const rings = [80, 140, 200];
  const nodes = [
    { angle: -75, r: 80, kind: "p" },
    { angle: 30, r: 80, kind: "s" },
    { angle: 150, r: 80, kind: "p" },
    { angle: -110, r: 140, kind: "s" },
    { angle: -40, r: 140, kind: "p" },
    { angle: 60, r: 140, kind: "p" },
    { angle: 130, r: 140, kind: "s" },
    { angle: -150, r: 200, kind: "p" },
    { angle: -90, r: 200, kind: "p" },
    { angle: -20, r: 200, kind: "s" },
    { angle: 80, r: 200, kind: "p" },
    { angle: 170, r: 200, kind: "s" },
  ];
  const crossLinks: [number, number][] = [
    [0, 4],
    [1, 6],
    [3, 8],
    [5, 10],
    [7, 11],
  ];

  const toXY = (n: (typeof nodes)[number]) => ({
    x: cx + Math.cos((n.angle * Math.PI) / 180) * n.r,
    y: cy + Math.sin((n.angle * Math.PI) / 180) * n.r,
  });

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="max-w-[480px] flex-[1_1_320px]"
    >
      {rings.map((r) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--pearl-200)"
          strokeWidth="1"
        />
      ))}
      <circle
        cx={cx}
        cy={cy}
        r={240}
        fill="none"
        stroke="var(--pearl-200)"
        strokeWidth="1"
        strokeDasharray="2 4"
      />
      {nodes.map((n, i) => {
        const p = toXY(n);
        return (
          <line
            key={`l${i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--pearl-200)"
            strokeWidth="1"
          />
        );
      })}
      {crossLinks.map(([a, b], i) => {
        const pa = toXY(nodes[a]);
        const pb = toXY(nodes[b]);
        return (
          <line
            key={`x${i}`}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke="var(--nucleus-blue)"
            strokeWidth="1"
            strokeOpacity="0.35"
          />
        );
      })}
      {/* Center */}
      <circle cx={cx} cy={cy} r="32" fill="var(--nucleus-blue)" />
      <circle cx={cx} cy={cy} r="10" fill="white" />
      <circle cx={cx} cy={cy} r="4" fill="var(--nucleus-blue)" />
      {/* Nodes */}
      {nodes.map((n, i) => {
        const p = toXY(n);
        return n.kind === "s" ? (
          <rect
            key={i}
            x={p.x - 8}
            y={p.y - 8}
            width="16"
            height="16"
            rx="2"
            fill="white"
            stroke="var(--graphite)"
            strokeWidth="1.5"
          />
        ) : (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="9"
            fill="white"
            stroke="var(--nucleus-blue)"
            strokeWidth="1.8"
          />
        );
      })}
      {/* Legend */}
      <g transform={`translate(20, ${h - 40})`}>
        <circle cx="6" cy="6" r="6" fill="white" stroke="var(--nucleus-blue)" strokeWidth="1.5" />
        <text
          x="20"
          y="10"
          fill="var(--slate)"
          fontFamily="var(--font-mono)"
          fontSize="10"
        >
          PEOPLE
        </text>
        <rect
          x="80"
          y="0"
          width="12"
          height="12"
          rx="2"
          fill="white"
          stroke="var(--graphite)"
          strokeWidth="1.5"
        />
        <text
          x="100"
          y="10"
          fill="var(--slate)"
          fontFamily="var(--font-mono)"
          fontSize="10"
        >
          STARTUPS
        </text>
      </g>
    </svg>
  );
}
