/* Shared components for Nucleus Hub. All style objects use unique names (nx*) to avoid scope collisions. */

const { useState, useEffect, useMemo, useRef } = React;

// ── Logo + Monogram — Innovate Utah ──────────────────────────────────────────
// IU lockup: a stylized "IU" with a cobalt outline rising into the wordmark.
function IUMonogram({ size=28, color="var(--nucleus-blue)", bg="var(--white)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="7" fill={color} />
      <text x="20" y="27" textAnchor="middle"
            fontFamily='"Newsreader", serif' fontSize="21" fontWeight="500"
            fill={bg} letterSpacing="-0.04em">
        IU
      </text>
      {/* peak above the wordmark — Wasatch silhouette */}
      <path d="M 11 9 L 16 4 L 20 7 L 24 4 L 29 9"
            stroke={bg} strokeWidth="1.4" fill="none"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
    </svg>
  );
}
// legacy alias so nothing breaks
const NucleusMonogram = IUMonogram;

function IUWordmark({ inverse=false }) {
  const c = inverse ? "var(--white)" : "var(--nucleus-blue)";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:11 }}>
      <IUMonogram size={34} color={c} bg={inverse ? "var(--nucleus-blue)" : "var(--white)"} />
      <div style={{ display:"flex", flexDirection:"column", lineHeight:1 }}>
        <span className="display" style={{ fontSize:20.5, fontWeight:500, color:c, letterSpacing:"-0.012em" }}>
          Innovate <span style={{ fontStyle:"italic", fontWeight:400 }}>Utah</span>
        </span>
        <span style={{ fontSize:9.5, letterSpacing:"0.2em", textTransform:"uppercase", color:c, opacity:0.65, marginTop:3 }}>
          Connections Hub
        </span>
      </div>
    </div>
  );
}
const NucleusWordmark = IUWordmark;

// ── Avatar — initials on a Whisper field with Blue ring ──────────────────────
function Avatar({ name, size=44, tone="blue" }) {
  const initials = (name||"")
    .split(/\s+/).filter(Boolean).slice(0,2)
    .map(w => w[0]?.toUpperCase()).join("");
  const tones = {
    blue:   { bg:"var(--nucleus-blue)",  fg:"var(--wasatch-whisper)" },
    cream:  { bg:"var(--wasatch-whisper)", fg:"var(--nucleus-blue)"  },
    copper: { bg:"var(--copper)",        fg:"var(--white)"           },
  };
  const t = tones[tone] || tones.blue;
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background: t.bg, color: t.fg,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"var(--font-display)", fontWeight:500, fontSize: size*0.42,
      letterSpacing:"-0.01em",
      border: tone === "cream" ? "1px solid var(--whisper-300)" : "none"
    }}>
      {initials || "·"}
    </div>
  );
}

// ── Pill (sector / network / generic) ─────────────────────────────────────────
function Pill({ children, tone="default", icon=null }) {
  const cls = tone === "blue"   ? "pill pill-blue"
            : tone === "copper" ? "pill pill-copper"
            : tone === "solid"  ? "pill pill-solid"
            : "pill";
  return <span className={cls}>{icon}{children}</span>;
}

// ── Score arc + dimension bars (for match cards) ─────────────────────────────
function ScoreArc({ score, size=72, label=true }) {
  // semicircle 0..1 fill
  const r = size/2 - 6;
  const cx = size/2, cy = size/2;
  const C = Math.PI * r;
  const dash = C * Math.max(0, Math.min(1, score));
  const color = score >= 0.7 ? "var(--copper)" : score >= 0.4 ? "var(--nucleus-blue-500)" : "var(--slate-light)";
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--whisper-200)" strokeWidth="6"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6"
                strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
                style={{ transition:"stroke-dasharray 0.6s ease" }}/>
      </svg>
      <div style={{
        position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", lineHeight:1
      }}>
        <span className="display" style={{ fontSize: size*0.32, fontWeight:500, color:"var(--nucleus-blue)" }}>
          {Math.round(score*100)}
        </span>
        {label && <span style={{ fontSize:9, letterSpacing:"0.14em", color:"var(--slate)", marginTop:2 }}>FIT</span>}
      </div>
    </div>
  );
}

function DimensionBars({ dims }) {
  const order = ["sector","role","skill","stage","mission","location","risk"];
  const labels = { sector:"Sector", role:"Role", skill:"Skills", stage:"Stage", mission:"Mission", location:"Location", risk:"Risk fit" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:6, width:"100%" }}>
      {order.map(k => {
        const v = Math.max(0, Math.min(1, dims?.[k] ?? 0));
        const color = v >= 0.7 ? "var(--copper)" : v >= 0.4 ? "var(--nucleus-blue-500)" : "var(--whisper-300)";
        return (
          <div key={k} style={{ display:"grid", gridTemplateColumns:"68px 1fr 28px", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:"var(--slate)" }}>{labels[k]}</span>
            <div style={{ height:6, background:"var(--whisper-200)", borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${v*100}%`, height:"100%", background: color, transition:"width 0.5s ease" }} />
            </div>
            <span className="mono" style={{ fontSize:10.5, textAlign:"right", color:"var(--slate)" }}>
              {(v*100).toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Route-aware hero content — keys to App's `route` state
const ROUTE_HERO = {
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

// (removed TopBanner — the blue hero IS the top banner now)


// ── Top navigation bar — editorial / institutional, two-row ───────────────────
function TopNav({ route, setRoute }) {
  const tabs = [
    { id:"browse",  label:"Browse"     },
    { id:"match",   label:"Match"      },
    { id:"profile", label:"My Profile" },
    { id:"onboard", label:"Join"       },
  ];

  return (
    <header style={{
      position:"sticky", top:0, zIndex:50,
      background:"var(--sand-50)",
      borderBottom:"1px solid var(--sand-300)"
    }}>
      <nav style={{
        maxWidth:1440, margin:"0 auto", padding:"6px 28px 0",
        display:"flex", gap:4, alignItems:"flex-end"
      }}>
        {tabs.map(t => {
          const on = route === t.id;
          return (
            <button key={t.id} onClick={() => setRoute(t.id)}
              style={{
                padding:"10px 18px 11px",
                position:"relative", borderRadius:0,
                color: on ? "var(--nucleus-blue)" : "var(--ink-muted)",
                fontFamily:"var(--font-display)",
                fontSize: on ? 22 : 21,
                fontWeight: 400,
                fontStyle: on ? "italic" : "normal",
                letterSpacing:"-0.005em",
                lineHeight:1,
                transition:"color 0.12s"
              }}>
              {t.label}
              <span style={{
                position:"absolute", left:18, right:18, bottom:-1, height:2,
                background: on ? "var(--nucleus-blue)" : "transparent",
                transition:"background 0.15s"
              }}/>
            </button>
          );
        })}
        <div style={{ flex:1 }}/>
      </nav>
    </header>
  );
}

// (legacy — referenced elsewhere, no-op now since status moved into nav)
function ApiStatusBadge() { return null; }

// ── Brand palette panel ──────────────────────────────────────────────────────
function BrandPanel({ open, onClose }) {
  if (!open) return null;
  const cells = [
    { name:"Nucleus Cobalt",   v:"#0848B8", role:"PRIMARY",     token:"--nucleus-blue" },
    { name:"Blue 700",         v:"#073A98", role:"hover",       token:"--blue-700" },
    { name:"Blue 600",         v:"#0E54CC", role:"link · solid",token:"--blue-600" },
    { name:"Blue 500",         v:"#2D6FE0", role:"highlight",   token:"--blue-500" },
    { name:"Blue 300",         v:"#6E97EB", role:"chart stroke",token:"--blue-300" },
    { name:"Blue 100",         v:"#DCE6FA", role:"tint fill",   token:"--blue-100" },
    { name:"Blue 50",          v:"#F2F6FE", role:"accent bg",   token:"--blue-50" },
    { name:"Pearl",            v:"#FAFBFD", role:"PAGE BG",     token:"--pearl" },
    { name:"Pearl 200",        v:"#EFF2F7", role:"divider",     token:"--pearl-200" },
    { name:"Pearl 300",        v:"#E2E6EE", role:"border",      token:"--pearl-300" },
    { name:"Graphite",         v:"#1A2233", role:"body / heads",token:"--graphite" },
    { name:"Graphite Muted",   v:"#5A6478", role:"secondary",   token:"--graphite-muted" },
    { name:"Graphite Light",   v:"#94A0B5", role:"placeholder", token:"--graphite-light" },
    { name:"Wasatch Gold",     v:"#D89A36", role:"ACCENT · match",      token:"--gold" },
    { name:"Gold Soft",        v:"#F4DEA8", role:"accent tint",         token:"--gold-soft" },
    { name:"Coral",            v:"#E16A4D", role:"ACCENT · spotlight",  token:"--coral" },
    { name:"Coral Soft",       v:"#FBE0D6", role:"accent tint",         token:"--coral-soft" },
    { name:"Sage",             v:"#5A9D8C", role:"ACCENT · growth",     token:"--sage" },
    { name:"Sage Soft",        v:"#DEF0EA", role:"accent tint",         token:"--sage-soft" },
    { name:"Plum",             v:"#7C5AA0", role:"ACCENT · community",  token:"--plum" },
    { name:"Plum Soft",        v:"#ECE3F4", role:"accent tint",         token:"--plum-soft" },
  ];
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(15,44,79,0.35)", zIndex:80,
                                    display:"flex", justifyContent:"flex-end" }}>
      <div onClick={e=>e.stopPropagation()} className="fade-in"
           style={{ width:480, maxWidth:"90vw", background:"var(--whisper-50)", height:"100%",
                    overflowY:"auto", borderLeft:"1px solid var(--color-border)" }}>
        <div style={{ padding:"24px 28px", borderBottom:"1px solid var(--color-border)" }}>
          <div className="tiny-caps">Brand System</div>
          <h2 className="display" style={{ fontSize:30, margin:"6px 0 4px", color:"var(--nucleus-blue)" }}>
            Color tokens
          </h2>
          <p style={{ margin:0, color:"var(--slate)", fontSize:13 }}>
            <strong>Innovate Utah</strong> palette — cobalt anchor (#0848B8) on pearl surfaces, graphite type, and one warm <strong style={{color:"var(--gold-deep)"}}>Wasatch gold</strong> accent for energy. Built for a Utah innovation network.
          </p>
        </div>
        <div style={{ padding:"20px 28px", display:"grid", gap:8 }}>
          {cells.map(c => (
            <div key={c.token} style={{
              display:"grid", gridTemplateColumns:"56px 1fr auto", gap:14, alignItems:"center",
              padding:"10px 12px", background:"white", border:"1px solid var(--color-border-soft)", borderRadius:8
            }}>
              <div style={{ height:44, background:c.v, borderRadius:6, border:"1px solid rgba(0,0,0,0.06)" }} />
              <div style={{ display:"flex", flexDirection:"column", lineHeight:1.2 }}>
                <span style={{ fontWeight:500, color:"var(--charcoal)", fontSize:13.5 }}>{c.name}</span>
                <span className="mono" style={{ fontSize:11, color:"var(--slate)" }}>{c.token}</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2 }}>
                <span className="mono" style={{ fontSize:11.5, color:"var(--charcoal)" }}>{c.v}</span>
                <span style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--slate-light)" }}>{c.role}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"8px 28px 32px", color:"var(--slate)", fontSize:12, lineHeight:1.55 }}>
          <p><strong>Usage rules:</strong> Sub-brand lockups are always Blue-on-Whisper or White-on-Blue — no other tints. Headings: Newsreader serif in Nucleus Blue. Body: Geist sans in Charcoal.</p>
        </div>
      </div>
    </div>
  );
}

// ── Person/Startup cards ──────────────────────────────────────────────────────
function PersonCard({ p, selected, onClick, dense=false, badge=null }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick}
         onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
         className={"card card-hover"} style={{
      textAlign:"left", padding: dense ? 14 : 18, width:"100%", cursor:"pointer",
      borderColor: selected ? "var(--nucleus-blue)" : undefined,
      boxShadow: selected ? "0 0 0 1px var(--nucleus-blue) inset" : undefined,
      display:"grid", gridTemplateColumns: dense ? "auto 1fr" : "auto 1fr auto", gap:14, alignItems:"flex-start"
    }}>
      <Avatar name={p.name} size={dense?40:48} />
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span className="display" style={{ fontSize:dense?17:19, fontWeight:500, color:"var(--charcoal)" }}>{p.name}</span>
          <span style={{ fontSize:11, color:"var(--slate)", letterSpacing:"0.04em" }}>· {p.location_city}</span>
        </div>
        <div style={{ fontSize:13, color:"var(--slate)", marginTop:2, marginBottom:8 }}>{p.headline}</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {(p.sectors_of_interest||[]).slice(0,3).map(s => (
            <Pill key={s} tone="blue">{window.NX.SECTOR_LABEL[s]}</Pill>
          ))}
          {(p.role_titles_seeking||[]).slice(0,2).filter(r=>r!=="other").map(r => (
            <Pill key={r}>{r.replace("_"," ")}</Pill>
          ))}
        </div>
      </div>
      {!dense && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
          {badge}
          <span className="tiny-caps">{window.NX.NETWORK_LABEL[p.primary_network]?.split(" ")[0] || ""}</span>
        </div>
      )}
    </div>
  );
}

function StartupCard({ s, selected, onClick, dense=false, badge=null }) {
  return (
    <div role="button" tabIndex={0} onClick={onClick}
         onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(); } }}
         className="card card-hover" style={{
      textAlign:"left", padding: dense ? 14 : 18, width:"100%", cursor:"pointer",
      borderColor: selected ? "var(--copper)" : undefined,
      boxShadow: selected ? "0 0 0 1px var(--copper) inset" : undefined,
      display:"grid", gridTemplateColumns: dense ? "1fr" : "1fr auto", gap:12
    }}>
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
          <span className="display" style={{ fontSize:dense?18:21, fontWeight:500, color:"var(--nucleus-blue)" }}>{s.name}</span>
          <span style={{ fontSize:11, color:"var(--slate)", letterSpacing:"0.04em" }}>{s.location_city}</span>
        </div>
        <div style={{ fontSize:13, color:"var(--charcoal)", marginTop:4, marginBottom:10 }}>{s.one_liner}</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          <Pill tone="blue">{window.NX.SECTOR_LABEL[s.sector]}</Pill>
          <Pill>{window.NX.STAGE_LABEL[s.stage]}</Pill>
          {(s.roles_needed||[]).slice(0,3).map(r => <Pill key={r}>+ {r.replace("_"," ")}</Pill>)}
        </div>
      </div>
      {!dense && badge && <div>{badge}</div>}
    </div>
  );
}

// ── Connection web (radial graph) ─────────────────────────────────────────────
function ConnectionWeb({ connections, currentUser, onPick }) {
  // Layout: rings of warmth (close → far). Up to 12 outer nodes.
  const top = connections.slice(0, 14);
  const W = 640, H = 480, cx = W/2, cy = H/2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", maxHeight:560 }}>
      {/* warmth rings */}
      {[0.85, 0.6, 0.35].map((w, i) => (
        <circle key={i} cx={cx} cy={cy} r={70 + i*70} fill="none"
                stroke="var(--whisper-300)" strokeDasharray="3 5" strokeWidth="1" opacity="0.7"/>
      ))}
      {/* spokes */}
      {top.map((c, i) => {
        const a = (i / top.length) * Math.PI * 2 - Math.PI/2;
        const radius = 70 + (1 - c.warmth) * 140;
        const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
        const stroke = c.warmth >= 0.6 ? "var(--copper)" : c.warmth >= 0.35 ? "var(--nucleus-blue-400)" : "var(--whisper-300)";
        return (
          <line key={"l"+i} x1={cx} y1={cy} x2={x} y2={y}
                stroke={stroke} strokeWidth={Math.max(0.6, c.warmth*2.2)} opacity="0.85"/>
        );
      })}
      {/* nodes */}
      {top.map((c, i) => {
        const a = (i / top.length) * Math.PI * 2 - Math.PI/2;
        const radius = 70 + (1 - c.warmth) * 140;
        const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
        const initials = c.person.name.split(/\s+/).slice(0,2).map(w=>w[0]).join("");
        const tx = cx + Math.cos(a) * (radius+18), ty = cy + Math.sin(a) * (radius+18);
        return (
          <g key={"n"+i} style={{ cursor:"pointer" }} onClick={() => onPick(c.person)}>
            <circle cx={x} cy={y} r={20} fill="var(--wasatch-whisper)" stroke="var(--nucleus-blue)" strokeWidth="1.5"/>
            <text x={x} y={y+4} textAnchor="middle" fontFamily='"Newsreader", serif'
                  fontSize="13" fill="var(--nucleus-blue)">{initials}</text>
            <text x={tx} y={ty} textAnchor={Math.cos(a) > 0.1 ? "start" : Math.cos(a) < -0.1 ? "end" : "middle"}
                  fontSize="10.5" fill="var(--slate)" dominantBaseline="middle"
                  style={{ fontFamily:"var(--font-sans)" }}>
              {c.person.name.split(" ")[0]} · {Math.round(c.warmth*100)}
            </text>
          </g>
        );
      })}
      {/* center self */}
      <circle cx={cx} cy={cy} r={30} fill="var(--nucleus-blue)"/>
      <text x={cx} y={cy+5} textAnchor="middle" fontFamily='"Newsreader", serif'
            fontSize="20" fill="var(--wasatch-whisper)">
        {currentUser?.name?.split(" ").map(w=>w[0]).slice(0,2).join("") || "·"}
      </text>
    </svg>
  );
}

// ── Sidesheet (detail drawer) ────────────────────────────────────────────────
function Sidesheet({ open, onClose, title, subtitle, children, accent="blue" }) {
  if (!open) return null;
  const accentColor = accent === "copper" ? "var(--copper)" : "var(--nucleus-blue)";
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(15,44,79,0.35)", zIndex:70,
                                    display:"flex", justifyContent:"flex-end" }}>
      <div onClick={e=>e.stopPropagation()} className="fade-in"
           style={{ width:560, maxWidth:"94vw", background:"var(--whisper-50)", height:"100%",
                    overflowY:"auto", borderLeft:"1px solid var(--color-border)" }}>
        <div style={{ padding:"22px 28px 16px", borderBottom:"1px solid var(--color-border)",
                      borderTop:`3px solid ${accentColor}`, position:"sticky", top:0, background:"var(--whisper-50)", zIndex:1 }}>
          <div className="tiny-caps">{subtitle}</div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <h2 className="display" style={{ fontSize:30, margin:"4px 0 0", color:"var(--nucleus-blue)" }}>{title}</h2>
            <button onClick={onClose} className="btn btn-ghost" style={{ padding:"6px 12px", fontSize:12 }}>Close ✕</button>
          </div>
        </div>
        <div style={{ padding:"24px 28px 48px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// expose
Object.assign(window, {
  IUMonogram, IUWordmark,
  NucleusMonogram, NucleusWordmark,
  Avatar, Pill,
  ScoreArc, DimensionBars,
  ROUTE_HERO,
  TopNav, ApiStatusBadge, BrandPanel,
  PersonCard, StartupCard, ConnectionWeb, Sidesheet,
});
