import { useState } from "react";

interface LinkedInPageProps {
  onContinue: () => void;
  onSkip: () => void;
}

export function LinkedInPage({ onContinue, onSkip }: LinkedInPageProps) {
  const [linkedin, setLinkedin] = useState("");
  const [scraping, setScraping] = useState(false);

  const fakeScrape = () => {
    setScraping(true);
    setTimeout(() => {
      setScraping(false);
      onContinue();
    }, 900);
  };

  return (
    <div>
      <div className="max-w-[880px] mx-auto pt-32 px-32 pb-64">
        <div className="card p-32">
          <h2 className="font-display text-[24px] text-nucleus-blue mb-4">
            Pull from LinkedIn
          </h2>
          <p className="text-graphite-muted mb-18 text-[13.5px]">
            We'll fetch your headline, sectors, and skills. You stay in control of what's
            visible.
          </p>
          <div className="relative">
            <span className="absolute left-14 top-13 text-graphite-light text-[13px]">
              linkedin.com/in/
            </span>
            <input
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="your-handle"
              className="w-full py-12 pr-14 pl-132 rounded-[8px] border border-pearl-300 text-[14px] bg-white"
            />
          </div>
          <div className="flex gap-10 mt-14">
            <button className="btn btn-primary" onClick={fakeScrape} disabled={scraping}>
              {scraping ? "Reading your profile…" : "Pre-fill from LinkedIn"}
            </button>
            <button className="btn btn-ghost" onClick={onSkip} disabled={scraping}>
              Skip — fill manually
            </button>
          </div>
          {scraping && <ScrapeProgress />}

          <div className="mt-32 py-16 px-18 bg-blue-50 rounded-[8px] text-[12.5px] text-graphite leading-[1.6]">
            <strong>What we extract:</strong> headline, current title, prior companies,
            education, public skills, location. <strong>What we don't:</strong> private posts,
            connections, anything behind a login.
          </div>
        </div>
      </div>
    </div>
  );
}

function ScrapeProgress() {
  const stages = [
    "Resolving handle…",
    "Reading public sections…",
    "Mapping skills to Nucleus taxonomy…",
    "Drafting profile.",
  ];
  return (
    <div className="mt-18 py-14 px-16 bg-pearl rounded-[8px] border border-pearl-200">
      {stages.map((s, i) => (
        <div
          key={i}
          className="fade-in flex items-center gap-10 text-[12.5px] text-graphite-muted py-4"
          style={{ animationDelay: `${i * 0.28}s` }}
        >
          <span className="w-8 h-8 rounded-full bg-gold" />
          <span className="font-mono">{s}</span>
        </div>
      ))}
    </div>
  );
}
