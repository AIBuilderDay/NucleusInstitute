// Single hero shown across every tab. Keeping the banner constant gives the
// app a stable identity instead of remixing the headline on every nav click.

export type Route = "browse" | "match" | "profile" | "onboard";

export interface HeroContent {
  eyebrow: string;
  title: string;
  lede: string;
}

export const HERO: HeroContent = {
  eyebrow: "Innovate Utah · Connections Hub",
  title: "Connecting Utah's deep-tech ecosystem.",
  lede: "Operators, mentors, advisors, investors, and service providers — connected to the startups Utah is building. Browse, match, and introduce.",
};
