// Mutual-style swipe deck — single profile card center stage, drag/swipe to advance,
// tap to open detail. Works for both people and startups.
const { useState: _useState, useEffect: _useEffect, useRef: _useRef, useMemo: _useMemo, useCallback: _useCallback } = React;

// Deterministic gradient/pattern tied to id, so each profile feels different.
function cardArt(seed = "") {
  const palettes = [
    ["#0F2C4F","#1F4F8A","#F0E8D6"], // blue → whisper
    ["#7A4A2C","#B25438","#F0E8D6"], // copper → whisper
    ["#2D4A3A","#5C7A5C","#F0E8D6"], // sage → whisper
    ["#0F2C4F","#9B7B3F","#F0E8D6"], // blue → gold
    ["#3A2A1F","#B25438","#F0E8D6"], // graphite → clay
    ["#1F4F8A","#6FA0CF","#F0E8D6"], // ocean
    ["#7A4A2C","#9B7B3F","#F0E8D6"], // canyon
    ["#2D4A3A","#9B7B3F","#F0E8D6"], // sage gold
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

// Stylized "photo" hero — colored gradient panel with the subject's initials big,
// a faint Wasatch silhouette, and a soft grain. Stands in for real photography.
function CardHero({ name, kind, sectorLabel, isStartup }) {
  const [a, b, c] = cardArt(name);
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();

  return (
    <div style={{
      position:"relative", height:"58%", width:"100%",
      background:`linear-gradient(155deg, ${a} 0%, ${b} 80%)`,
      overflow:"hidden",
      display:"flex", alignItems:"flex-end", justifyContent:"flex-start"
    }}>
      {/* faint Wasatch silhouette */}
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden
           style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.18 }}>
        <path d="M 0 200 L 60 130 L 110 165 L 175 95 L 230 145 L 295 70 L 360 140 L 400 110 L 400 240 L 0 240 Z"
              fill={c}/>
        <path d="M 0 240 L 50 195 L 110 215 L 180 175 L 240 215 L 310 175 L 380 220 L 400 200 L 400 240 Z"
              fill={c} opacity="0.55"/>
      </svg>

      {/* big initials watermark */}
      <span style={{
        position:"absolute", right:-12, top:-30,
        fontSize:280, fontFamily:"var(--font-display)", fontWeight:300,
        color:"rgba(240,232,214,0.10)", letterSpacing:"-0.04em", lineHeight:1,
        userSelect:"none", pointerEvents:"none"
      }}>{initials}</span>

      {/* grain via repeating dots */}
      <svg width="100%" height="100%" style={{ position:"absolute", inset:0, opacity:0.18, mixBlendMode:"overlay" }} aria-hidden>
        <defs>
          <pattern id={`grain-${initials}`} width="3" height="3" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="rgba(255,255,255,0.4)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grain-${initials})`}/>
      </svg>

      {/* foreground initials (medallion) */}
      <div style={{
        position:"relative", margin:"0 0 24px 28px",
        display:"flex", alignItems:"center", gap:14
      }}>
        {isStartup ? (
          <div style={{
            width:64, height:64, borderRadius:14,
            background:"rgba(240,232,214,0.95)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"var(--font-display)", fontSize:30, fontWeight:500,
            color: a, letterSpacing:"-0.02em"
          }}>{initials}</div>
        ) : (
          <div style={{
            width:64, height:64, borderRadius:"50%",
            background:"rgba(240,232,214,0.95)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:"var(--font-display)", fontSize:28, fontWeight:500,
            color: a, letterSpacing:"-0.02em"
          }}>{initials}</div>
        )}
        <div style={{
          padding:"5px 11px", borderRadius:999,
          background:"rgba(240,232,214,0.16)",
          border:"1px solid rgba(240,232,214,0.28)",
          fontSize:11, color:"#F0E8D6", letterSpacing:"0.06em", textTransform:"uppercase"
        }}>{sectorLabel}</div>
      </div>

      {/* gradient bottom fade so type sits on solid */}
      <div style={{
        position:"absolute", left:0, right:0, bottom:0, height:90,
        background:"linear-gradient(to top, rgba(15,44,79,0.4), transparent)"
      }}/>
    </div>
  );
}

function PersonSwipeCard({ p, onTap }) {
  const sector = NX.SECTOR_LABEL[p.sectors_of_interest?.[0]] || "—";
  const network = NX.NETWORK_LABEL[p.primary_network] || "Network";
  const looking = (p.role_titles_seeking || []).map(r => r.replace(/_/g," ")).slice(0,2).join(" · ");
  const mission = (p.mission_keywords || [])[0];

  return (
    <div onClick={onTap} style={{
      width:"100%", height:"100%", borderRadius:24, overflow:"hidden",
      background:"var(--white)",
      boxShadow:"0 24px 60px rgba(15,44,79,0.20), 0 4px 12px rgba(15,44,79,0.10)",
      display:"flex", flexDirection:"column",
      cursor:"pointer", userSelect:"none"
    }}>
      <CardHero name={p.name} kind="person" sectorLabel={sector} />

      <div style={{ padding:"18px 22px 16px", flex:1, display:"flex", flexDirection:"column", gap:10 }}>
        <div>
          <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
            <h2 className="display" style={{
              margin:0, fontSize:28, fontWeight:500, letterSpacing:"-0.012em",
              color:"var(--ink)", lineHeight:1.05
            }}>{p.name}</h2>
            <span style={{ fontSize:13, color:"var(--ink-muted)" }}>
              {p.years_experience}y · {p.location_city}
            </span>
          </div>
          <div style={{ fontSize:13.5, color:"var(--ink-muted)", marginTop:4, lineHeight:1.4 }}>
            {p.headline}
          </div>
        </div>

        {/* prompt-style row */}
        <div style={{
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:8,
          marginTop:2
        }}>
          <PromptChip label="Looking for" value={looking || "—"} tone="blue"/>
          <PromptChip label="Network"     value={network.replace(" Network","")} tone="copper"/>
        </div>
        {mission && (
          <PromptChip label="Mission" value={mission} tone="sand" wide/>
        )}

        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:"auto" }}>
          {(p.trust_badges || []).slice(0,3).map(b => (
            <span key={b} style={{
              fontSize:10.5, padding:"3px 9px", borderRadius:999,
              background:"var(--whisper-200)", color:"var(--ink)",
              border:"1px solid var(--sand-300)", letterSpacing:"0.02em"
            }}>{b}</span>
          ))}
          <span style={{ flex:1 }}/>
          <span style={{ fontSize:11, color:"var(--ink-light)", alignSelf:"center" }}>Tap to read more →</span>
        </div>
      </div>
    </div>
  );
}

function StartupSwipeCard({ s, onTap }) {
  const sector = NX.SECTOR_LABEL[s.sector] || "—";
  const stage = NX.STAGE_LABEL[s.stage] || s.stage;
  const need = (s.roles_needed || []).slice(0,2).map(r => r.replace(/_/g," ")).join(" · ");

  return (
    <div onClick={onTap} style={{
      width:"100%", height:"100%", borderRadius:24, overflow:"hidden",
      background:"var(--white)",
      boxShadow:"0 24px 60px rgba(15,44,79,0.20), 0 4px 12px rgba(15,44,79,0.10)",
      display:"flex", flexDirection:"column",
      cursor:"pointer", userSelect:"none"
    }}>
      <CardHero name={s.name} kind="startup" sectorLabel={sector} isStartup/>

      <div style={{ padding:"18px 22px 16px", flex:1, display:"flex", flexDirection:"column", gap:10 }}>
        <div>
          <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
            <h2 className="display" style={{
              margin:0, fontSize:28, fontWeight:500, letterSpacing:"-0.012em",
              color:"var(--ink)", lineHeight:1.05
            }}>{s.name}</h2>
            <span style={{ fontSize:13, color:"var(--ink-muted)" }}>
              {stage} · {s.location_city}
            </span>
          </div>
          <div style={{ fontSize:13.5, color:"var(--ink-muted)", marginTop:4, lineHeight:1.4 }}>
            {s.one_liner}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <PromptChip label="Hiring" value={need || "—"} tone="copper"/>
          <PromptChip label="Team"   value={`${s.team_size} people`} tone="blue"/>
        </div>
        {s.mission_keywords?.[0] && (
          <PromptChip label="Mission" value={s.mission_keywords[0]} tone="sand" wide/>
        )}

        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:"auto" }}>
          {(s.trust_badges || []).slice(0,3).map(b => (
            <span key={b} style={{
              fontSize:10.5, padding:"3px 9px", borderRadius:999,
              background:"var(--whisper-200)", color:"var(--ink)",
              border:"1px solid var(--sand-300)", letterSpacing:"0.02em"
            }}>{b}</span>
          ))}
          <span style={{ flex:1 }}/>
          <span style={{ fontSize:11, color:"var(--ink-light)", alignSelf:"center" }}>Tap to read more →</span>
        </div>
      </div>
    </div>
  );
}

function PromptChip({ label, value, tone="blue", wide=false }) {
  const bg = { blue:"#EAF1F8", copper:"#FBEFE8", sand:"#F5EEDE" }[tone] || "#EAF1F8";
  const fg = { blue:"var(--nucleus-blue)", copper:"var(--copper)", sand:"var(--graphite)" }[tone] || "var(--ink)";
  return (
    <div style={{
      gridColumn: wide ? "1 / -1" : "auto",
      background: bg, padding:"8px 12px", borderRadius:10,
      display:"flex", flexDirection:"column", gap:2, minWidth:0
    }}>
      <span style={{
        fontSize:9.5, letterSpacing:"0.10em", textTransform:"uppercase",
        color: fg, opacity:0.7, fontWeight:600
      }}>{label}</span>
      <span style={{
        fontSize:13, color:"var(--ink)",
        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        textTransform: wide ? "none" : "capitalize"
      }}>{value}</span>
    </div>
  );
}

// ── The deck itself ─────────────────────────────────────────────────────────
function SwipeDeck({ items, kind, onView, onConnect, onPass, emptyText }) {
  const [idx, setIdx] = _useState(0);
  const [drag, setDrag] = _useState({ x:0, y:0 });
  const [exit, setExit] = _useState(null); // "left" | "right" | null
  const startRef = _useRef(null);
  const movedRef = _useRef(false);

  // reset deck when items change (filters)
  _useEffect(() => { setIdx(0); setDrag({x:0,y:0}); setExit(null); }, [items]);

  const top = items[idx];
  const next1 = items[idx+1];
  const next2 = items[idx+2];

  const commit = _useCallback((dir) => {
    if (!top || exit) return;
    setExit(dir);
    if (dir === "right") onConnect?.(top);
    else onPass?.(top);
    setTimeout(() => {
      setIdx(i => i + 1);
      setDrag({ x:0, y:0 });
      setExit(null);
    }, 280);
  }, [top, exit, onConnect, onPass]);

  // pointer drag
  const onPointerDown = (e) => {
    if (exit) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!startRef.current || exit) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true;
    setDrag({ x: dx, y: dy });
  };
  const onPointerUp = () => {
    if (!startRef.current) return;
    startRef.current = null;
    if (Math.abs(drag.x) > 110) commit(drag.x > 0 ? "right" : "left");
    else setDrag({ x:0, y:0 });
  };
  // click vs drag distinguishing
  const handleTap = (item) => () => {
    if (movedRef.current) return;
    onView?.(item);
  };

  // keyboard
  _useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft")  commit("left");
      if (e.key === "ArrowRight") commit("right");
      if (e.key === "Enter" && top) onView?.(top);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, top, onView]);

  if (!top) {
    return (
      <div style={{
        height:600, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        color:"var(--ink-muted)", textAlign:"center", gap:14
      }}>
        <div className="display" style={{ fontSize:32, color:"var(--nucleus-blue)" }}>
          You've reached the end.
        </div>
        <div style={{ fontSize:14 }}>{emptyText || "No more profiles match those filters."}</div>
        <button className="btn btn-ghost" onClick={() => setIdx(0)}>Start over</button>
      </div>
    );
  }

  // compute transforms
  const rot = drag.x / 18; // deg
  const dragOpacity = Math.min(1, Math.abs(drag.x) / 110);
  const goingRight = drag.x > 0;

  let topTransform, topTransition;
  if (exit === "right") {
    topTransform = `translate(640px, ${drag.y - 40}px) rotate(28deg)`;
    topTransition = "transform 0.28s cubic-bezier(.2,.7,.2,1), opacity 0.28s";
  } else if (exit === "left") {
    topTransform = `translate(-640px, ${drag.y - 40}px) rotate(-28deg)`;
    topTransition = "transform 0.28s cubic-bezier(.2,.7,.2,1), opacity 0.28s";
  } else {
    topTransform = `translate(${drag.x}px, ${drag.y * 0.4}px) rotate(${rot}deg)`;
    topTransition = startRef.current ? "none" : "transform 0.22s cubic-bezier(.2,.7,.2,1)";
  }

  const renderCard = (item) =>
    kind === "startup"
      ? <StartupSwipeCard s={item} onTap={handleTap(item)}/>
      : <PersonSwipeCard p={item} onTap={handleTap(item)}/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:18 }}>
      {/* deck stage */}
      <div style={{
        position:"relative", width:"min(420px, 92vw)", height:620,
        perspective:"1200px"
      }}>
        {/* card 3 (deepest) */}
        {next2 && (
          <div style={{
            position:"absolute", inset:0,
            transform:"translateY(20px) scale(0.92)",
            opacity:0.5, pointerEvents:"none",
            transition:"transform 0.22s, opacity 0.22s"
          }}>{renderCard(next2)}</div>
        )}
        {/* card 2 */}
        {next1 && (
          <div style={{
            position:"absolute", inset:0,
            transform:"translateY(10px) scale(0.96)",
            opacity:0.85, pointerEvents:"none",
            transition:"transform 0.22s, opacity 0.22s"
          }}>{renderCard(next1)}</div>
        )}
        {/* top card */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position:"absolute", inset:0,
            transform: topTransform,
            transition: topTransition,
            opacity: exit ? 0.2 : 1,
            touchAction:"none"
          }}>
          {renderCard(top)}

          {/* PASS / CONNECT swipe stamps */}
          <div style={{
            position:"absolute", top:38, left:28,
            padding:"8px 16px", borderRadius:8,
            border:"3px solid var(--clay)",
            color:"var(--clay)", background:"rgba(178,84,56,0.08)",
            fontFamily:"var(--font-display)", fontSize:30, fontStyle:"italic",
            transform: `rotate(-12deg) scale(${!goingRight ? dragOpacity : 0})`,
            opacity: !goingRight ? dragOpacity : 0,
            pointerEvents:"none", letterSpacing:"0.02em",
            transition: startRef.current ? "none" : "opacity 0.2s, transform 0.2s"
          }}>Pass</div>
          <div style={{
            position:"absolute", top:38, right:28,
            padding:"8px 16px", borderRadius:8,
            border:"3px solid var(--sage)",
            color:"var(--sage)", background:"rgba(45,74,58,0.08)",
            fontFamily:"var(--font-display)", fontSize:30, fontStyle:"italic",
            transform: `rotate(12deg) scale(${goingRight ? dragOpacity : 0})`,
            opacity: goingRight ? dragOpacity : 0,
            pointerEvents:"none", letterSpacing:"0.02em",
            transition: startRef.current ? "none" : "opacity 0.2s, transform 0.2s"
          }}>Connect</div>
        </div>
      </div>

      {/* action buttons */}
      <div style={{ display:"flex", gap:18, alignItems:"center" }}>
        <CircleAction label="Pass" tone="clay" onClick={() => commit("left")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18"/>
            <line x1="18" y1="6" x2="6" y2="18"/>
          </svg>
        </CircleAction>
        <CircleAction label="View" tone="blue" onClick={() => onView?.(top)} small>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 4v12 M12 20h.01"/>
            <circle cx="12" cy="12" r="9" strokeWidth="1.5"/>
          </svg>
        </CircleAction>
        <CircleAction label="Connect" tone="sage" onClick={() => commit("right")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </CircleAction>
      </div>

      {/* progress + keyboard hint */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, marginTop:4 }}>
        <div style={{ fontSize:11, color:"var(--ink-muted)", letterSpacing:"0.04em" }}>
          {idx + 1} of {items.length}
        </div>
        <div style={{ fontSize:10.5, color:"var(--ink-light)" }}>
          ← pass · → connect · ↵ details
        </div>
      </div>
    </div>
  );
}

function CircleAction({ children, label, tone="blue", onClick, small=false }) {
  const bg = { clay:"var(--white)", blue:"var(--white)", sage:"var(--white)" }[tone];
  const color = { clay:"var(--clay)", blue:"var(--nucleus-blue)", sage:"var(--sage)" }[tone];
  const ring = { clay:"rgba(178,84,56,0.25)", blue:"rgba(15,44,79,0.20)", sage:"rgba(45,74,58,0.25)" }[tone];
  const size = small ? 48 : 60;
  return (
    <button onClick={onClick} aria-label={label} title={label}
      style={{
        width:size, height:size, borderRadius:"50%",
        background: bg, color, border:`1.5px solid ${ring}`,
        boxShadow:"0 4px 12px rgba(15,44,79,0.12), 0 1px 3px rgba(15,44,79,0.08)",
        display:"flex", alignItems:"center", justifyContent:"center",
        cursor:"pointer", transition:"transform 0.12s"
      }}
      onMouseEnter={(e)=> e.currentTarget.style.transform="translateY(-2px)"}
      onMouseLeave={(e)=> e.currentTarget.style.transform="translateY(0)"}>
      {children}
    </button>
  );
}

Object.assign(window, { SwipeDeck, PersonSwipeCard, StartupSwipeCard });
