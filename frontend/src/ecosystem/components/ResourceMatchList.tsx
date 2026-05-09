import { useEffect, useMemo, useState } from "react";
import type { UserMatch } from "../EcosystemContext";
import { loadResources, type Resource } from "../data/resourcesLoader";
import { rankResources, type RankedResource } from "../data/resourceScoring";

const PAGE_SIZE = 5;

interface ResourceMatchListProps {
  match: UserMatch;
}

export function ResourceMatchList({ match }: ResourceMatchListProps) {
  const [all, setAll] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let dead = false;
    void (async () => {
      try {
        const r = await loadResources();
        if (!dead) setAll(r);
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // Reset to page 1 when the match (i.e. user's filters) changes
  useEffect(() => {
    setPage(0);
  }, [match]);

  const ranked = useMemo<RankedResource[]>(() => {
    if (!all.length) return [];
    return rankResources(all, match);
  }, [all, match]);

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const pageItems = ranked.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) {
    return <div className="shimmer" style={{ height: 360 }} />;
  }
  if (error) {
    return (
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 8,
          background: "#fbe8e0",
          color: "#8a3a3a",
          fontSize: 13,
        }}
      >
        ⚠ Could not load resources: {error}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <div className="tiny-caps" style={{ color: "var(--nucleus-blue)" }}>
            Best matches for you
          </div>
          <h3
            className="display"
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: "var(--nucleus-blue)",
              margin: "2px 0 0",
              lineHeight: 1.2,
            }}
          >
            {ranked.length} state resources
          </h3>
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--slate)" }}>
          page {page + 1} of {totalPages}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pageItems.map((r, i) => (
          <ResourceCard key={r.resource.id} ranked={r} index={page * PAGE_SIZE + i + 1} />
        ))}
        {pageItems.length === 0 && (
          <div
            className="card"
            style={{ padding: 24, textAlign: "center", color: "var(--slate)" }}
          >
            No resources matched your filters. Try editing your interests.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            marginTop: 18,
          }}
        >
          <PageBtn
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ‹
          </PageBtn>
          {pageNumbers(page, totalPages).map((n, i) =>
            n === -1 ? (
              <span
                key={`gap-${i}`}
                style={{ color: "var(--slate-light)", padding: "0 4px", fontSize: 13 }}
              >
                …
              </span>
            ) : (
              <PageBtn key={n} active={n === page} onClick={() => setPage(n)}>
                {n + 1}
              </PageBtn>
            ),
          )}
          <PageBtn
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            ›
          </PageBtn>
        </div>
      )}
    </div>
  );
}

function ResourceCard({
  ranked,
  index,
}: {
  ranked: RankedResource;
  index: number;
}) {
  const r = ranked.resource;
  return (
    <div className="card card-hover" style={{ padding: "14px 16px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--slate-light)",
            paddingTop: 4,
            minWidth: 24,
          }}
        >
          #{String(index).padStart(2, "0")}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            className="display"
            style={{
              fontSize: 17,
              fontWeight: 500,
              color: "var(--nucleus-blue)",
              lineHeight: 1.25,
            }}
          >
            {r.title}
          </div>
          {r.description && (
            <p
              style={{
                fontSize: 12.5,
                color: "var(--slate)",
                margin: "5px 0 0",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {r.description}
            </p>
          )}
          {ranked.reasons.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {ranked.reasons.slice(0, 3).map((reason, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    color: "var(--nucleus-blue)",
                    background: "var(--blue-50)",
                    border: "1px solid var(--blue-200)",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {reason}
                </span>
              ))}
            </div>
          )}
        </div>
        {r.link && (
          <a
            href={r.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{
              padding: "6px 12px",
              fontSize: 12,
              flexShrink: 0,
              alignSelf: "center",
            }}
          >
            Visit ↗
          </a>
        )}
      </div>
    </div>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32,
        height: 32,
        borderRadius: 6,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        border: `1px solid ${active ? "var(--nucleus-blue)" : "var(--color-border)"}`,
        background: active ? "var(--nucleus-blue)" : "var(--white)",
        color: active ? "var(--wasatch-whisper)" : "var(--charcoal)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** Minimal page-number window with ellipses for long ranges. -1 = ellipsis. */
function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const out: number[] = [];
  out.push(0);
  if (current > 2) out.push(-1);
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) {
    out.push(i);
  }
  if (current < total - 3) out.push(-1);
  out.push(total - 1);
  return out;
}
