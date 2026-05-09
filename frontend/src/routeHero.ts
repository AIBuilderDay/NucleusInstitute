export type Route = "browse" | "match" | "profile" | "onboard";

export interface HeroContent {
  eyebrow: string;
  title: string;
  lede: string;
}

export const ROUTE_HERO: Record<Route, HeroContent> = {
  browse: {
    eyebrow: "The Network",
    title: "Find your match across Utah's innovation ecosystem.",
    lede: "Operators, mentors, advisors, investors, and service providers — connected to the deep-tech startups Innovate Utah is building. Search, browse, then run the matcher to see ranked, explainable fit.",
  },
  match: {
    eyebrow: "Matching Engine",
    title: "Explainable matches, ranked across the Utah ecosystem.",
    lede: "Hard filters eliminate dealbreakers. Soft scoring across seven dimensions ranks the rest. Every match shows its reasoning.",
  },
  profile: {
    eyebrow: "Your Profile",
    title: "Your network, your matches, your reach.",
    lede: "See your connection web, today's top startup fits, and where your profile is strongest.",
  },
  onboard: {
    eyebrow: "Join the Network",
    title: "Become part of Utah's deep-tech connections fabric.",
    lede: "Paste your LinkedIn, confirm what we extracted, and set your match preferences. Three steps, you're in.",
  },
};
