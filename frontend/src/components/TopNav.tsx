import type { Route } from "../routeHero";

interface TopNavProps {
  route: Route;
  setRoute: (r: Route) => void;
}

const TABS: ReadonlyArray<{ id: Route; label: string }> = [
  { id: "explore", label: "Explore" },
  { id: "match", label: "Match" },
  { id: "profile", label: "My Profile" },
  { id: "onboard", label: "Join" },
];

export function TopNav({ route, setRoute }: TopNavProps) {
  return (
    <header
      className="sticky top-0 z-50 bg-pearl border-b border-pearl-300"
    >
      <nav
        className="max-w-[1440px] mx-auto pt-6 px-28 pb-0 flex gap-4 items-end"
      >
        <button
          onClick={() => setRoute("explore")}
          aria-label="Innovate Utah — home"
          className="pt-6 pr-16 pb-6 pl-0 flex items-center bg-transparent border-0 cursor-pointer"
        >
          <img
            src="/InnovateUtah.png"
            alt="Innovate Utah"
            className="h-38 w-auto block"
          />
        </button>
        {TABS.map((t) => {
          const on = route === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setRoute(t.id)}
              className={`pt-10 px-18 pb-11 relative rounded-none font-display font-normal tracking-[-0.005em] leading-none transition-colors duration-[120ms] ${
                on
                  ? "text-nucleus-blue text-[22px] italic"
                  : "text-graphite-muted text-[21px] not-italic"
              }`}
            >
              {t.label}
              <span
                className={`absolute left-18 right-18 -bottom-1 h-2 transition-[background] duration-[150ms] ${
                  on ? "bg-nucleus-blue" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
        <div className="flex-1" />
      </nav>
    </header>
  );
}
