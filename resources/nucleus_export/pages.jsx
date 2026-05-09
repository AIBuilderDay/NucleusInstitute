/* Page-level screens for Nucleus Hub. */

const NX = window.NX;

// ════════════════════════════════════════════════════════════════════════════
// HERO STRIP — used on Browse and Profile, evokes the institutional /innovation
// feel of nucleusutah.org (Blue field on Whisper section)
// ════════════════════════════════════════════════════════════════════════════
function HeroStrip({ eyebrow, title, lede, side=null, dense=false }) {
  return (
    <section style={{
      background:"var(--nucleus-blue)", color:"var(--wasatch-whisper)",
      borderBottom:"1px solid var(--nucleus-blue-600)"
    }}>
      <div style={{
        maxWidth:1440, margin:"0 auto", padding: dense ? "36px 32px 36px" : "56px 32px 56px",
        minHeight: dense ? 196 : 280,
        display:"grid", gridTemplateColumns: side ? "1fr 380px" : "1fr", gap:48, alignItems:"center"
      }}>
        <div>
          <div className="tiny-caps" style={{ color:"var(--copper-soft)" }}>{eyebrow}</div>
          <h1 className="display" style={{
            fontSize: dense ? 38 : 56, fontWeight:400, margin:"10px 0 14px", maxWidth:760,
            color:"var(--wasatch-whisper)", lineHeight:1.12
          }}>{title}</h1>
          {lede && (
            <p style={{ margin:0, fontSize:16, lineHeight:1.55, color:"rgba(240,232,214,0.78)", maxWidth:620 }}>
              {lede}
            </p>
          )}
        </div>
        {side && <div>{side}</div>}
      </div>
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// BROWSE PAGE
// ════════════════════════════════════════════════════════════════════════════
function BrowsePage({ onPickPerson, onPickStartup, onMatchPerson, onMatchStartup }) {
  const [tab, setTab] = useState("people");
  const [sectorFilter, setSectorFilter] = useState([]);
  const [networkFilter, setNetworkFilter] = useState([]);
  const [stageFilter, setStageFilter] = useState([]);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);

  const people = useMemo(() => {
    return NX.PEOPLE.filter(p => {
      if (sectorFilter.length && !p.sectors_of_interest.some(s => sectorFilter.includes(s))) return false;
      if (networkFilter.length && !networkFilter.includes(p.primary_network)) return false;
      if (query && !(p.name + " " + p.headline + " " + p.skills.join(" ")).toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [sectorFilter, networkFilter, query]);
  const startups = useMemo(() => {
    return NX.STARTUPS.filter(s => {
      if (sectorFilter.length && !sectorFilter.includes(s.sector) && !(s.sectors_secondary||[]).some(x => sectorFilter.includes(x))) return false;
      if (stageFilter.length && !stageFilter.includes(s.stage)) return false;
      if (query && !(s.name + " " + s.one_liner).toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [sectorFilter, stageFilter, query]);

  const toggle = (arr, set, val) => set(arr.includes(val) ? arr.filter(x=>x!==val) : [...arr, val]);

  return (
    <div>
      <div style={{ maxWidth:1440, margin:"0 auto", padding:"32px 32px 64px" }}>
        {/* control bar */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:16, alignItems:"center", marginBottom:24 }}>
          <div style={{ display:"flex", background:"var(--whisper-200)", borderRadius:8, padding:3 }}>
            {["people","startups"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding:"8px 16px", borderRadius:6, fontSize:13, fontWeight:500,
                background: tab===t ? "var(--white)" : "transparent",
                color: tab===t ? "var(--nucleus-blue)" : "var(--slate)",
                boxShadow: tab===t ? "0 1px 2px rgba(15,44,79,0.08)" : "none"
              }}>
                {t==="people" ? `People · ${people.length}` : `Startups · ${startups.length}`}
              </button>
            ))}
          </div>

          <div style={{ position:"relative", flex:"1 1 280px", maxWidth:380 }}>
            <input type="text" placeholder={`Search ${tab}…`} value={query}
                   onChange={e=>setQuery(e.target.value)}
                   style={{
                     width:"100%", padding:"10px 14px 10px 36px", borderRadius:8,
                     border:"1px solid var(--color-border)", background:"var(--white)",
                     fontSize:13.5, color:"var(--charcoal)"
                   }}/>
            <span style={{ position:"absolute", left:12, top:10, color:"var(--slate-light)" }}>⌕</span>
          </div>

          <div style={{ flex:1 }}/>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-ghost" onClick={() => { setSectorFilter([]); setNetworkFilter([]); setStageFilter([]); setQuery(""); }}>
              Clear filters
            </button>
          </div>
        </div>

        {/* filter chips row */}
        <div style={{ display:"grid", gap:10, marginBottom:24 }}>
          <FilterRow label="Sector"
                     options={NX.SECTORS.map(s => [s, NX.SECTOR_LABEL[s]])}
                     selected={sectorFilter}
                     onToggle={v => toggle(sectorFilter, setSectorFilter, v)}/>
          {tab === "people" && (
            <FilterRow label="Network"
                       options={Object.entries(NX.NETWORK_LABEL)}
                       selected={networkFilter}
                       onToggle={v => toggle(networkFilter, setNetworkFilter, v)}/>
          )}
          {tab === "startups" && (
            <FilterRow label="Stage"
                       options={Object.entries(NX.STAGE_LABEL)}
                       selected={stageFilter}
                       onToggle={v => toggle(stageFilter, setStageFilter, v)}/>
          )}
        </div>

        {/* SWIPE DECK — Mutual-style, one profile at a time */}
        {tab === "people" ? (
          <SwipeDeck
            items={people}
            kind="person"
            onView={(p) => setDetail({ kind:"person", item:p })}
            onConnect={(p) => onMatchPerson(p)}
            onPass={() => {}}
            emptyText="Adjust filters or start over to see more people."
          />
        ) : (
          <SwipeDeck
            items={startups}
            kind="startup"
            onView={(s) => setDetail({ kind:"startup", item:s })}
            onConnect={(s) => onMatchStartup(s)}
            onPass={() => {}}
            emptyText="Adjust filters or start over to see more startups."
          />
        )}
      </div>

      {/* Detail sidesheet */}
      <Sidesheet open={!!detail && detail.kind==="person"} onClose={()=>setDetail(null)}
                 title={detail?.item?.name} subtitle="Profile · Operator Network"
                 accent="blue">
        {detail?.kind==="person" && <PersonDetailBody p={detail.item} onMatch={() => { onMatchPerson(detail.item); setDetail(null); }}/>}
      </Sidesheet>
      <Sidesheet open={!!detail && detail.kind==="startup"} onClose={()=>setDetail(null)}
                 title={detail?.item?.name} subtitle="Startup · seeking matches"
                 accent="copper">
        {detail?.kind==="startup" && <StartupDetailBody s={detail.item} onMatch={() => { onMatchStartup(detail.item); setDetail(null); }}/>}
      </Sidesheet>
    </div>
  );
}

function FilterRow({ label, options, selected, onToggle }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
      <span className="tiny-caps" style={{ minWidth:64 }}>{label}</span>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {options.map(([val, lab]) => {
          const on = selected.includes(val);
          return (
            <button key={val} onClick={() => onToggle(val)}
              style={{
                padding:"5px 12px", borderRadius:999, fontSize:12, fontWeight:500,
                border:`1px solid ${on ? "var(--nucleus-blue)" : "var(--color-border)"}`,
                background: on ? "var(--nucleus-blue)" : "var(--white)",
                color: on ? "var(--wasatch-whisper)" : "var(--charcoal)",
                transition:"all 0.12s"
              }}>
              {lab}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{ gridColumn:"1 / -1", padding:"48px", textAlign:"center",
                  border:"1px dashed var(--color-border)", borderRadius:10,
                  color:"var(--slate)", fontSize:14 }}>
      {children}
    </div>
  );
}

function PersonDetailBody({ p, onMatch }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
        <Avatar name={p.name} size={64}/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, color:"var(--slate)" }}>{p.headline}</div>
          <div style={{ fontSize:12, color:"var(--slate-light)", marginTop:4 }}>
            {p.location_city} · {p.years_experience}y · {p.availability.replace("_"," ")}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onMatch}>Run match →</button>
      </div>

      {p.bio && (
        <div style={{ fontSize:13.5, color:"var(--charcoal)", lineHeight:1.6,
                       background:"var(--wasatch-whisper)", padding:"14px 16px", borderRadius:8 }}>
          {p.bio}
        </div>
      )}

      <DetailGroup label="Sectors of interest">
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {p.sectors_of_interest.map(s => <Pill key={s} tone="blue">{NX.SECTOR_LABEL[s]}</Pill>)}
        </div>
      </DetailGroup>

      <DetailGroup label="Skills">
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {p.skills.map(s => <Pill key={s}>{s}</Pill>)}
        </div>
      </DetailGroup>

      {(p.trust_badges||[]).length > 0 && (
        <DetailGroup label="Trust badges">
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {p.trust_badges.map(b => <Pill key={b} tone="copper">◆ {b}</Pill>)}
          </div>
        </DetailGroup>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Stat k="Network" v={NX.NETWORK_LABEL[p.primary_network]}/>
        <Stat k="Risk tolerance" v={(p.risk_tolerance||"medium").replace(/^./, c=>c.toUpperCase())}/>
        <Stat k="Comp expectation" v={(p.comp_expectation_type||"").replace(/_/g," ")}/>
        <Stat k="Min salary" v={p.comp_min_salary_usd ? `$${p.comp_min_salary_usd.toLocaleString()}` : "—"}/>
      </div>
    </div>
  );
}

function StartupDetailBody({ s, onMatch }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:14 }}>
        <div>
          <div style={{ fontSize:14, color:"var(--slate)" }}>{s.one_liner}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:10 }}>
            <Pill tone="blue">{NX.SECTOR_LABEL[s.sector]}</Pill>
            <Pill>{NX.STAGE_LABEL[s.stage]}</Pill>
            {s.seeking_investment && <Pill tone="copper">Fundraising</Pill>}
          </div>
        </div>
        <button className="btn btn-copper" onClick={onMatch}>Find talent →</button>
      </div>

      {s.description && (
        <div style={{ fontSize:13.5, color:"var(--charcoal)", lineHeight:1.6,
                       background:"var(--wasatch-whisper)", padding:"14px 16px", borderRadius:8 }}>
          {s.description}
        </div>
      )}

      <DetailGroup label="Roles needed">
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {s.roles_needed.map(r => <Pill key={r} tone="blue">+ {r.replace("_"," ")}</Pill>)}
        </div>
      </DetailGroup>

      <DetailGroup label="Required skills">
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {(s.required_skills||[]).map(k => <Pill key={k}>{k}</Pill>)}
        </div>
      </DetailGroup>

      {(s.trust_badges||[]).length > 0 && (
        <DetailGroup label="Trust badges">
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {s.trust_badges.map(b => <Pill key={b} tone="copper">◆ {b}</Pill>)}
          </div>
        </DetailGroup>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Stat k="Stage" v={NX.STAGE_LABEL[s.stage]} />
        <Stat k="Team size" v={s.team_size}/>
        <Stat k="Total raised" v={`$${(s.total_raised_usd||0).toLocaleString()}`}/>
        <Stat k="Comp ceiling" v={s.comp_max_salary_usd ? `$${s.comp_max_salary_usd.toLocaleString()}` : "—"}/>
      </div>
    </div>
  );
}

function DetailGroup({ label, children }) {
  return (
    <div>
      <div className="tiny-caps" style={{ marginBottom:8 }}>{label}</div>
      {children}
    </div>
  );
}
function Stat({ k, v }) {
  return (
    <div style={{ background:"var(--white)", border:"1px solid var(--color-border-soft)",
                  borderRadius:8, padding:"10px 12px" }}>
      <div className="tiny-caps">{k}</div>
      <div className="display" style={{ fontSize:18, color:"var(--nucleus-blue)", marginTop:2 }}>{v}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MATCH PAGE
// ════════════════════════════════════════════════════════════════════════════
function MatchPage({ initialPerson, initialStartup, currentUser }) {
  const [direction, setDirection] = useState(initialStartup ? "startup_to_people" : "person_to_startups");
  const [personId, setPersonId] = useState(initialPerson?.id || currentUser?.id || NX.PEOPLE[0].id);
  const [startupId, setStartupId] = useState(initialStartup?.id || NX.STARTUPS[0].id);
  const [topK, setTopK] = useState(8);
  const [matcher, setMatcher] = useState("");
  const [sectorFilter, setSectorFilter] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [compare, setCompare] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (initialPerson) { setDirection("person_to_startups"); setPersonId(initialPerson.id); }
    if (initialStartup) { setDirection("startup_to_people"); setStartupId(initialStartup.id); }
  }, [initialPerson, initialStartup]);

  // auto-run when inputs change
  useEffect(() => {
    let dead = false;
    (async () => {
      setLoading(true); setCompare(null);
      let r;
      if (direction === "person_to_startups") {
        r = await NX.api.matchPerson(personId, { topK, sectorFilter, matcher: matcher || undefined });
      } else {
        r = await NX.api.matchStartup(startupId, { topK });
      }
      if (!dead) { setResults(r); setLoading(false); }
    })();
    return () => { dead = true; };
  }, [direction, personId, startupId, topK, matcher, sectorFilter.join(",")]);

  const me = NX.PEOPLE.find(p => p.id === personId);
  const su = NX.STARTUPS.find(s => s.id === startupId);

  const runCompare = async () => {
    if (direction !== "person_to_startups") return;
    setLoading(true);
    const r = await NX.api.compare(personId, { topK });
    setCompare(r);
    setLoading(false);
  };

  return (
    <div>
      <div style={{ maxWidth:1440, margin:"0 auto", padding:"28px 32px 64px",
                    display:"grid", gridTemplateColumns:"380px 1fr", gap:24 }}>

        {/* CONTROL PANEL */}
        <aside className="card" style={{ padding:22, alignSelf:"start", position:"sticky", top:88 }}>
          <div className="tiny-caps">Find Matches</div>
          <h3 className="display" style={{ margin:"6px 0 18px", fontSize:24, color:"var(--nucleus-blue)" }}>Configure</h3>

          {/* Direction toggle */}
          <div style={{ display:"flex", background:"var(--whisper-200)", borderRadius:8, padding:3, marginBottom:18 }}>
            {[
              { id:"person_to_startups", l:"I'm a person" },
              { id:"startup_to_people",  l:"I'm a startup"},
            ].map(t => (
              <button key={t.id} onClick={()=>setDirection(t.id)} style={{
                flex:1, padding:"7px 10px", borderRadius:6, fontSize:12, fontWeight:500,
                background: direction===t.id ? "var(--white)" : "transparent",
                color: direction===t.id ? "var(--nucleus-blue)" : "var(--slate)"
              }}>{t.l}</button>
            ))}
          </div>

          {direction === "person_to_startups" ? (
            <Field label="I am…" hint="Auto-loaded from Browse.">
              <select value={personId} onChange={e=>setPersonId(e.target.value)} style={selectStyle}>
                {NX.PEOPLE.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.role_category.replace("_"," ")}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="The startup is…">
              <select value={startupId} onChange={e=>setStartupId(e.target.value)} style={selectStyle}>
                {NX.STARTUPS.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {NX.SECTOR_LABEL[s.sector]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {direction === "person_to_startups" && (
            <Field label="Looking for sectors" hint="Optional. Empty = all.">
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {NX.SECTORS.map(s => {
                  const on = sectorFilter.includes(s);
                  return (
                    <button key={s} onClick={()=>setSectorFilter(on ? sectorFilter.filter(x=>x!==s) : [...sectorFilter,s])}
                      style={{
                        padding:"5px 10px", borderRadius:999, fontSize:11.5, fontWeight:500,
                        border:`1px solid ${on ? "var(--copper)" : "var(--color-border)"}`,
                        background: on ? "var(--copper-faint)" : "var(--white)",
                        color: on ? "#8a5e1f" : "var(--charcoal)"
                      }}>
                      {NX.SECTOR_LABEL[s]}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Top K">
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <input type="range" min={3} max={20} value={topK}
                     onChange={e=>setTopK(parseInt(e.target.value))}
                     style={{ flex:1 }}/>
              <span className="mono" style={{ minWidth:24, textAlign:"right" }}>{topK}</span>
            </div>
          </Field>

          <Field label="Matcher" hint="Provider override (default = rule_filter).">
            <select value={matcher} onChange={e=>setMatcher(e.target.value)} style={selectStyle}>
              <option value="">(default)</option>
              <option value="rule_filter">rule_filter</option>
              <option value="embedding">embedding (TO-DO)</option>
              <option value="agentic">agentic (TO-DO)</option>
            </select>
          </Field>

          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button className="btn btn-primary" style={{ flex:1 }}
                    onClick={() => { /* effect handles it; this is feedback */ }}>
              Find matches
            </button>
            <button className="btn btn-ghost" onClick={runCompare}
                    disabled={direction !== "person_to_startups"}>
              Compare matchers
            </button>
          </div>

          {/* tiny summary of who is matching */}
          <div style={{ marginTop:18, padding:"12px 14px", background:"var(--whisper-50)",
                        borderRadius:8, border:"1px solid var(--color-border-soft)" }}>
            <div className="tiny-caps">Querying for</div>
            {direction === "person_to_startups" && me && (
              <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8 }}>
                <Avatar name={me.name} size={36}/>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{me.name}</div>
                  <div style={{ fontSize:11, color:"var(--slate)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{me.headline}</div>
                </div>
              </div>
            )}
            {direction === "startup_to_people" && su && (
              <div style={{ marginTop:8 }}>
                <div className="display" style={{ fontSize:18, color:"var(--nucleus-blue)" }}>{su.name}</div>
                <div style={{ fontSize:12, color:"var(--slate)" }}>{su.one_liner}</div>
              </div>
            )}
          </div>
        </aside>

        {/* RESULTS */}
        <main>
          {loading && !results && <ResultSkeleton/>}

          {compare && <CompareResults compare={compare}/>}

          {!compare && results && (
            <>
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between",
                            marginBottom:14, flexWrap:"wrap", gap:8 }}>
                <h2 className="display" style={{ fontSize:26, color:"var(--nucleus-blue)", margin:0 }}>
                  {results.matches.length} ranked matches
                </h2>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span className="tiny-caps">Source</span>
                  <span className="mono" style={{
                    fontSize:11, padding:"3px 8px", borderRadius:999,
                    background: results.source==="live" ? "var(--copper-faint)" : "var(--whisper-200)",
                    color: results.source==="live" ? "#8a5e1f" : "var(--slate)"
                  }}>
                    {results.source==="live" ? "LIVE BACKEND" : "MOCK"}
                  </span>
                </div>
              </div>

              {results.matches.map((m, i) => (
                <MatchCard key={i} match={m} index={i+1}
                           direction={direction}
                           expanded={expanded===i}
                           onToggle={() => setExpanded(expanded===i ? null : i)}/>
              ))}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function MatchCard({ match, index, direction, expanded, onToggle }) {
  const target = direction === "person_to_startups"
    ? (match.startup || NX.STARTUPS.find(s => s.id === match.startup_id))
    : (match.person  || NX.PEOPLE.find(p => p.id === match.talent_id));
  if (!target) return null;
  const isStartup = direction === "person_to_startups";
  const blocked = !match.passed_hard_filters;

  return (
    <div className="card fade-in" style={{
      padding:20, marginBottom:12, opacity: blocked ? 0.66 : 1,
      borderColor: blocked ? "var(--whisper-300)" : "var(--color-border-soft)"
    }}>
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr auto", gap:18, alignItems:"flex-start" }}>
        {/* left: rank + score arc */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
          <span className="mono" style={{ fontSize:11, color:"var(--slate-light)" }}>
            #{String(index).padStart(2,"0")}
          </span>
          <ScoreArc score={match.score}/>
        </div>

        {/* middle: identity + reasons */}
        <div style={{ minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
            <span className="display" style={{ fontSize:22, fontWeight:500,
                                              color: isStartup ? "var(--nucleus-blue)" : "var(--charcoal)" }}>
              {target.name}
            </span>
            <span style={{ fontSize:12, color:"var(--slate)" }}>
              · {isStartup ? `${NX.SECTOR_LABEL[target.sector]} · ${NX.STAGE_LABEL[target.stage]} · ${target.location_city}`
                          : `${target.headline}`}
            </span>
          </div>
          {!isStartup && (
            <div style={{ fontSize:12, color:"var(--slate)", marginTop:2 }}>
              {target.location_city} · {target.years_experience}y · {NX.NETWORK_LABEL[target.primary_network]}
            </div>
          )}
          {isStartup && (
            <div style={{ fontSize:13.5, color:"var(--charcoal)", marginTop:6 }}>{target.one_liner}</div>
          )}

          {match.reasons?.length > 0 && (
            <ul style={{ margin:"12px 0 6px", paddingLeft:0, listStyle:"none", display:"flex", flexDirection:"column", gap:5 }}>
              {match.reasons.slice(0, expanded ? 8 : 3).map((r, i) => (
                <li key={i} style={{ fontSize:13, color:"var(--charcoal)", display:"flex", gap:8 }}>
                  <span style={{ color:"var(--copper)", fontWeight:600 }}>+</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {match.blockers?.length > 0 && (
            <ul style={{ margin:"6px 0 0", paddingLeft:0, listStyle:"none" }}>
              {match.blockers.map((b, i) => (
                <li key={i} style={{ fontSize:13, color:"#8a3a3a", display:"flex", gap:8 }}>
                  <span style={{ fontWeight:600 }}>✕</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* right: bars (expanded only) + toggle */}
        <div style={{ width:240, display:"flex", flexDirection:"column", gap:10 }}>
          {expanded && <DimensionBars dims={match.dimension_scores}/>}
          <div style={{ display:"flex", gap:6, justifyContent:"flex-end", flexWrap:"wrap" }}>
            <button onClick={onToggle} className="btn btn-ghost"
                    style={{ padding:"6px 12px", fontSize:12 }}>
              {expanded ? "Less" : "Breakdown"}
            </button>
            {!blocked && (
              <button className="btn btn-primary" style={{ padding:"6px 12px", fontSize:12 }}>
                Introduce →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareResults({ compare }) {
  const matchers = Object.keys(compare.by_matcher);
  return (
    <div>
      <h2 className="display" style={{ fontSize:26, color:"var(--nucleus-blue)", margin:"0 0 6px" }}>
        Side-by-side
      </h2>
      <p style={{ color:"var(--slate)", fontSize:13.5, marginTop:0, marginBottom:18 }}>
        Same talent. Three matchers. Compare top picks across rule-based, embedding, and agentic providers.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${matchers.length}, 1fr)`, gap:14 }}>
        {matchers.map(m => (
          <div key={m} className="card" style={{ padding:14 }}>
            <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:10 }}>
              <span className="display" style={{ fontSize:15, color:"var(--nucleus-blue)" }}>{m}</span>
              <span className="mono" style={{ fontSize:10, color:"var(--slate-light)" }}>top {compare.by_matcher[m].length}</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {compare.by_matcher[m].slice(0, 6).map((mm, i) => {
                const t = mm.startup || NX.STARTUPS.find(s => s.id === mm.startup_id);
                if (!t) return null;
                return (
                  <div key={i} style={{
                    display:"grid", gridTemplateColumns:"24px 1fr auto", gap:8, alignItems:"center",
                    padding:"8px 10px", background:"var(--whisper-50)", borderRadius:6
                  }}>
                    <span className="mono" style={{ fontSize:10.5, color:"var(--slate-light)" }}>#{i+1}</span>
                    <span style={{ fontSize:12.5, fontWeight:500, color:"var(--charcoal)",
                                   overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</span>
                    <span className="mono" style={{ fontSize:11, color: mm.score >= 0.7 ? "var(--copper)" : "var(--slate)"  }}>
                      {Math.round(mm.score*100)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {[0,1,2,3].map(i => (
        <div key={i} className="card" style={{ padding:20, display:"grid",
          gridTemplateColumns:"72px 1fr 240px", gap:18 }}>
          <div className="shimmer" style={{ height:72, width:72, borderRadius:"50%" }}/>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div className="shimmer" style={{ height:18, width:"60%" }}/>
            <div className="shimmer" style={{ height:12, width:"82%" }}/>
            <div className="shimmer" style={{ height:12, width:"40%" }}/>
          </div>
          <div className="shimmer" style={{ height:60, width:"100%" }}/>
        </div>
      ))}
    </div>
  );
}

const selectStyle = {
  width:"100%", padding:"9px 12px", borderRadius:6,
  border:"1px solid var(--color-border)", background:"var(--white)",
  fontSize:13, color:"var(--charcoal)"
};
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:500, color:"var(--charcoal)", marginBottom:6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:"var(--slate-light)", marginTop:4 }}>{hint}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MY PROFILE PAGE — connection web + warmth + recent matches
// ════════════════════════════════════════════════════════════════════════════
function MyProfilePage({ currentUser, onPickPerson, onSwitchUser, onMatchPerson }) {
  const me = currentUser;
  const conns = useMemo(() => NX.connections(me.id), [me.id]);
  const [recent, setRecent] = useState([]);
  const [pickedConn, setPickedConn] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await NX.api.matchPerson(me.id, { topK:5 });
      setRecent(r.matches);
    })();
  }, [me.id]);

  const warm = conns.filter(c => c.warmth >= 0.6).length;
  const direct = conns.filter(c => c.warmth >= 0.35).length;
  const total = conns.length;

  return (
    <div>
      {/* warm / institutional hero with the user's identity */}
      <section style={{ background:"var(--wasatch-whisper)", borderBottom:"1px solid var(--whisper-300)" }}>
        <div style={{ maxWidth:1440, margin:"0 auto", padding:"40px 32px",
                      display:"grid", gridTemplateColumns:"auto 1fr auto", gap:28, alignItems:"center" }}>
          <Avatar name={me.name} size={96} tone="blue"/>
          <div>
            <div className="tiny-caps">My profile · {NX.NETWORK_LABEL[me.primary_network]}</div>
            <h1 className="display" style={{ fontSize:48, fontWeight:400, margin:"6px 0 8px",
                                              color:"var(--nucleus-blue)", letterSpacing:"-0.01em" }}>
              {me.name}
            </h1>
            <div style={{ fontSize:15, color:"var(--charcoal)" }}>{me.headline}</div>
            <div style={{ display:"flex", gap:6, marginTop:12, flexWrap:"wrap" }}>
              {(me.trust_badges||[]).map(b => <Pill key={b} tone="copper">◆ {b}</Pill>)}
              {(me.sectors_of_interest||[]).slice(0,3).map(s => <Pill key={s} tone="blue">{NX.SECTOR_LABEL[s]}</Pill>)}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <button className="btn btn-primary" onClick={() => onMatchPerson(me)}>Run my match →</button>
            <select onChange={e=>onSwitchUser(e.target.value)} value={me.id} style={{...selectStyle, fontSize:12}}>
              {NX.PEOPLE.map(p => <option key={p.id} value={p.id}>View as: {p.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div style={{ maxWidth:1440, margin:"0 auto", padding:"32px 32px 64px",
                    display:"grid", gridTemplateColumns:"1fr 380px", gap:28 }}>

        {/* CONNECTION WEB */}
        <section className="card" style={{ padding:24 }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:8 }}>
            <div>
              <div className="tiny-caps">Network — Connection web</div>
              <h2 className="display" style={{ fontSize:26, color:"var(--nucleus-blue)", margin:"4px 0 0" }}>
                Your Wasatch graph
              </h2>
            </div>
            <div style={{ display:"flex", gap:18 }}>
              <Metric n={warm}   l="Warm" sub="≥ 0.6"/>
              <Metric n={direct} l="Direct" sub="≥ 0.35"/>
              <Metric n={total}  l="Reachable" sub="all"/>
            </div>
          </div>

          <ConnectionWeb connections={conns} currentUser={me} onPick={setPickedConn} />

          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:11, color:"var(--slate)" }}>
            <span>Inner ring = warmer (shared sector + university + city + mission)</span>
            <span>· Click a node to inspect</span>
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <aside style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div className="card" style={{ padding:18 }}>
            <div className="tiny-caps">Top startup matches for you</div>
            <h3 className="display" style={{ fontSize:20, color:"var(--nucleus-blue)", margin:"6px 0 12px" }}>
              Today's fits
            </h3>
            {recent.slice(0,5).map((m, i) => {
              const t = m.startup || NX.STARTUPS.find(s => s.id === m.startup_id);
              if (!t) return null;
              return (
                <div key={i} style={{
                  display:"grid", gridTemplateColumns:"36px 1fr auto", gap:10, alignItems:"center",
                  padding:"10px 0", borderTop: i ? "1px solid var(--color-border-soft)" : "none"
                }}>
                  <ScoreArc score={m.score} size={36} label={false}/>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"var(--charcoal)" }}>{t.name}</div>
                    <div style={{ fontSize:11, color:"var(--slate)", whiteSpace:"nowrap",
                                   overflow:"hidden", textOverflow:"ellipsis" }}>
                      {NX.SECTOR_LABEL[t.sector]} · {NX.STAGE_LABEL[t.stage]}
                    </div>
                  </div>
                  <span style={{ fontSize:11, color: m.passed_hard_filters ? "var(--copper)" : "var(--slate-light)" }}>
                    {m.passed_hard_filters ? "open" : "blocked"}
                  </span>
                </div>
              );
            })}
            {!recent.length && <div className="shimmer" style={{ height:64, marginTop:8 }}/>}
          </div>

          <div className="card" style={{ padding:18 }}>
            <div className="tiny-caps">Profile completeness</div>
            <ProfileMeter person={me}/>
          </div>
        </aside>
      </div>

      <Sidesheet open={!!pickedConn} onClose={()=>setPickedConn(null)}
                 title={pickedConn?.name} subtitle="Connection · path through Nucleus">
        {pickedConn && (
          <div>
            <PersonDetailBody p={pickedConn} onMatch={() => { onMatchPerson(pickedConn); setPickedConn(null); }} />
          </div>
        )}
      </Sidesheet>
    </div>
  );
}

function Metric({ n, l, sub }) {
  return (
    <div style={{ textAlign:"right" }}>
      <div className="display" style={{ fontSize:30, color:"var(--nucleus-blue)", lineHeight:1 }}>{n}</div>
      <div style={{ fontSize:11, color:"var(--slate)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
        {l} <span style={{ color:"var(--slate-light)" }}>{sub}</span>
      </div>
    </div>
  );
}

function ProfileMeter({ person }) {
  const checks = [
    { k:"Headline",  v: !!person.headline },
    { k:"Sectors",   v: (person.sectors_of_interest||[]).length > 0 },
    { k:"Skills",    v: (person.skills||[]).length >= 3 },
    { k:"Mission",   v: (person.mission_keywords||[]).length > 0 },
    { k:"Bio",       v: !!person.bio },
    { k:"Comp expectations", v: !!person.comp_expectation_type },
    { k:"University", v: (person.university_affiliations||[]).length > 0 },
  ];
  const done = checks.filter(c => c.v).length;
  const pct = Math.round((done / checks.length) * 100);
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
        <span className="display" style={{ fontSize:30, color:"var(--copper)" }}>{pct}%</span>
        <span style={{ fontSize:11, color:"var(--slate)" }}>{done} / {checks.length} fields</span>
      </div>
      <div style={{ height:6, background:"var(--whisper-200)", borderRadius:3, overflow:"hidden", marginBottom:14 }}>
        <div style={{ width:`${pct}%`, height:"100%", background:"var(--copper)" }}/>
      </div>
      {checks.map(c => (
        <div key={c.k} style={{ display:"flex", justifyContent:"space-between",
                                fontSize:12.5, padding:"5px 0",
                                borderTop:"1px solid var(--color-border-soft)" }}>
          <span style={{ color:"var(--charcoal)" }}>{c.k}</span>
          <span style={{ color: c.v ? "var(--copper)" : "var(--slate-light)" }}>
            {c.v ? "✓" : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARD WIZARD — LinkedIn URL paste, fake scrape, structured profile
// ════════════════════════════════════════════════════════════════════════════
function OnboardPage({ onComplete }) {
  const [step, setStep] = useState(0);
  const [linkedin, setLinkedin] = useState("");
  const [scraping, setScraping] = useState(false);
  const [draft, setDraft] = useState({
    name:"", headline:"", role_category:"executive", availability:"full_time",
    primary_network:"operator", sectors_of_interest:[], skills:[], mission_keywords:[],
    location_city:"Salt Lake City", role_titles_seeking:[],
    comp_expectation_type:"salary_plus_equity", comp_min_salary_usd:150000,
    risk_tolerance:"medium", bio:""
  });

  const fakeScrape = () => {
    setScraping(true);
    // Animated stages of "scraping"
    setTimeout(() => {
      // Pull a representative profile from the corpus to populate
      const sample = NX.PEOPLE[Math.floor(Math.random() * Math.min(6, NX.PEOPLE.length))];
      setDraft({
        ...draft,
        name: sample.name,
        headline: sample.headline,
        role_category: sample.role_category,
        availability: sample.availability,
        primary_network: sample.primary_network,
        sectors_of_interest: sample.sectors_of_interest,
        skills: sample.skills,
        mission_keywords: sample.mission_keywords || [],
        location_city: sample.location_city,
        role_titles_seeking: sample.role_titles_seeking,
        comp_expectation_type: sample.comp_expectation_type,
        comp_min_salary_usd: sample.comp_min_salary_usd || 150000,
        risk_tolerance: sample.risk_tolerance,
        bio: sample.bio || ""
      });
      setScraping(false);
      setStep(1);
    }, 1400);
  };

  return (
    <div>

      <div style={{ maxWidth:880, margin:"0 auto", padding:"32px 32px 64px" }}>
        {/* Step indicator */}
        <div style={{ display:"flex", gap:6, marginBottom:24 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              flex:1, height:4, borderRadius:2,
              background: i <= step ? "var(--copper)" : "var(--whisper-200)"
            }}/>
          ))}
        </div>

        {step === 0 && (
          <div className="card" style={{ padding:32 }}>
            <h2 className="display" style={{ fontSize:24, color:"var(--nucleus-blue)", margin:"0 0 4px" }}>
              Pull from LinkedIn
            </h2>
            <p style={{ color:"var(--slate)", margin:"0 0 18px", fontSize:13.5 }}>
              We'll fetch your headline, sectors, and skills. You stay in control of what's visible.
            </p>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:14, top:13, color:"var(--slate-light)", fontSize:13 }}>
                linkedin.com/in/
              </span>
              <input value={linkedin} onChange={e=>setLinkedin(e.target.value)}
                     placeholder="your-handle"
                     style={{
                       width:"100%", padding:"12px 14px 12px 132px",
                       borderRadius:8, border:"1px solid var(--color-border)",
                       fontSize:14, background:"var(--white)"
                     }}/>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:14 }}>
              <button className="btn btn-primary" onClick={fakeScrape} disabled={scraping}>
                {scraping ? "Reading your profile…" : "Pre-fill from LinkedIn"}
              </button>
              <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={scraping}>
                Skip — fill manually
              </button>
            </div>
            {scraping && <ScrapeProgress/>}

            <div style={{ marginTop:32, padding:"16px 18px", background:"var(--wasatch-whisper)",
                           borderRadius:8, fontSize:12.5, color:"var(--charcoal)", lineHeight:1.6 }}>
              <strong>What we extract:</strong> headline, current title, prior companies, education, public skills, location. <strong>What we don't:</strong> private posts, connections, anything behind a login.
            </div>
          </div>
        )}

        {step === 1 && (
          <ConfirmProfileStep draft={draft} setDraft={setDraft}
                              onBack={() => setStep(0)} onNext={() => setStep(2)}/>
        )}

        {step === 2 && (
          <PreferencesStep draft={draft} setDraft={setDraft}
                           onBack={() => setStep(1)}
                           onFinish={() => onComplete({ ...draft, id:"p-you", trust_badges:["Self-verified"] })}/>
        )}
      </div>
    </div>
  );
}

function ScrapeProgress() {
  const stages = ["Resolving handle…", "Reading public sections…", "Mapping skills to Nucleus taxonomy…", "Drafting profile."];
  return (
    <div style={{ marginTop:18, padding:"14px 16px", background:"var(--whisper-50)",
                  borderRadius:8, border:"1px solid var(--color-border-soft)" }}>
      {stages.map((s, i) => (
        <div key={i} className="fade-in" style={{
          display:"flex", alignItems:"center", gap:10, fontSize:12.5,
          color:"var(--slate)", padding:"4px 0",
          animationDelay:`${i*0.28}s`
        }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--copper)" }}/>
          <span className="mono">{s}</span>
        </div>
      ))}
    </div>
  );
}

function ConfirmProfileStep({ draft, setDraft, onBack, onNext }) {
  const upd = (k, v) => setDraft({ ...draft, [k]: v });
  const tog = (k, v) => {
    const arr = draft[k] || [];
    setDraft({ ...draft, [k]: arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v] });
  };
  return (
    <div className="card" style={{ padding:28 }}>
      <h2 className="display" style={{ fontSize:24, color:"var(--nucleus-blue)", margin:"0 0 4px" }}>
        Your draft profile
      </h2>
      <p style={{ color:"var(--slate)", margin:"0 0 22px", fontSize:13.5 }}>
        Review what we extracted. Edit anything inline.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Field label="Name"><input style={selectStyle} value={draft.name} onChange={e=>upd("name",e.target.value)}/></Field>
        <Field label="Location"><input style={selectStyle} value={draft.location_city} onChange={e=>upd("location_city",e.target.value)}/></Field>
        <Field label="Headline">
          <input style={selectStyle} value={draft.headline} onChange={e=>upd("headline",e.target.value)}/>
        </Field>
        <Field label="Primary network">
          <select style={selectStyle} value={draft.primary_network} onChange={e=>upd("primary_network", e.target.value)}>
            {Object.entries(NX.NETWORK_LABEL).map(([k,l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Role category">
          <select style={selectStyle} value={draft.role_category} onChange={e=>upd("role_category", e.target.value)}>
            {["executive","operator","student","intern","board_member","advisor","mentor","investor","service_provider"].map(r =>
              <option key={r} value={r}>{r.replace("_"," ")}</option>
            )}
          </select>
        </Field>
        <Field label="Availability">
          <select style={selectStyle} value={draft.availability} onChange={e=>upd("availability", e.target.value)}>
            {["full_time","part_time","fractional","advisory","internship"].map(r =>
              <option key={r} value={r}>{r.replace("_"," ")}</option>
            )}
          </select>
        </Field>
      </div>

      <Field label="Sectors of interest" hint="Pick all that apply.">
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {NX.SECTORS.map(s => {
            const on = draft.sectors_of_interest.includes(s);
            return (
              <button key={s} onClick={() => tog("sectors_of_interest", s)} style={{
                padding:"6px 12px", borderRadius:999, fontSize:12, fontWeight:500,
                border:`1px solid ${on ? "var(--nucleus-blue)" : "var(--color-border)"}`,
                background: on ? "var(--nucleus-blue)" : "var(--white)",
                color: on ? "var(--wasatch-whisper)" : "var(--charcoal)"
              }}>{NX.SECTOR_LABEL[s]}</button>
            );
          })}
        </div>
      </Field>

      <Field label="Skills (comma-separated)">
        <input style={selectStyle} value={(draft.skills||[]).join(", ")}
               onChange={e=>upd("skills", e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}/>
      </Field>

      <Field label="Bio">
        <textarea rows={4} style={{...selectStyle, fontFamily:"inherit", resize:"vertical"}}
                  value={draft.bio} onChange={e=>upd("bio",e.target.value)}/>
      </Field>

      <div style={{ display:"flex", gap:10, marginTop:8 }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{ flex:1 }}/>
        <button className="btn btn-primary" onClick={onNext}>Continue →</button>
      </div>
    </div>
  );
}

function PreferencesStep({ draft, setDraft, onBack, onFinish }) {
  const upd = (k, v) => setDraft({ ...draft, [k]: v });
  return (
    <div className="card" style={{ padding:28 }}>
      <h2 className="display" style={{ fontSize:24, color:"var(--nucleus-blue)", margin:"0 0 4px" }}>
        What you're looking for
      </h2>
      <p style={{ color:"var(--slate)", margin:"0 0 22px", fontSize:13.5 }}>
        These power your match scores. Hard filters first, soft signals second.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Field label="Compensation expectation">
          <select style={selectStyle} value={draft.comp_expectation_type} onChange={e=>upd("comp_expectation_type", e.target.value)}>
            {["salary","equity","salary_plus_equity","free"].map(r =>
              <option key={r} value={r}>{r.replace(/_/g," ")}</option>
            )}
          </select>
        </Field>
        <Field label="Minimum salary (USD)">
          <input type="number" style={selectStyle} value={draft.comp_min_salary_usd}
                 onChange={e=>upd("comp_min_salary_usd", parseInt(e.target.value)||0)}/>
        </Field>
        <Field label="Risk tolerance">
          <select style={selectStyle} value={draft.risk_tolerance} onChange={e=>upd("risk_tolerance", e.target.value)}>
            {["low","medium","high"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Mission keywords (comma-separated)">
          <input style={selectStyle} value={(draft.mission_keywords||[]).join(", ")}
                 onChange={e=>upd("mission_keywords", e.target.value.split(",").map(s=>s.trim()).filter(Boolean))}/>
        </Field>
      </div>

      <div style={{ display:"flex", gap:10, marginTop:18 }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div style={{ flex:1 }}/>
        <button className="btn btn-copper" onClick={onFinish}>Publish & view matches →</button>
      </div>
    </div>
  );
}

Object.assign(window, {
  HeroStrip, BrowsePage, MatchPage, MyProfilePage, OnboardPage,
});
