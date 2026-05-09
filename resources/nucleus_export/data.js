/* Mock dataset + API client. Mirrors backend Pydantic schema (TalentResponse, StartupResponse, MatchResult).
   API client tries the live FastAPI backend first; on failure, falls back to in-browser mock matching. */

(function () {
  const SECTORS = ["life_sciences","ai","defense_aerospace","cyber","energy","advanced_manufacturing","fintech","software"];
  const SECTOR_LABEL = {
    life_sciences: "Life Sciences", ai: "AI", defense_aerospace: "Defense & Aerospace",
    cyber: "Cyber", energy: "Energy", advanced_manufacturing: "Advanced Mfg.",
    fintech: "Fintech", software: "Software"
  };
  const NETWORK_LABEL = {
    operator: "Operator Network", mentor: "Mentor Network", sme_advisor: "SME Advisory",
    venture: "Venture Network", service_provider: "Service Provider"
  };
  const STAGE_LABEL = { idea:"Idea", pre_seed:"Pre-Seed", seed:"Seed", series_a:"Series A", growth:"Growth" };

  // Compact people corpus (drawn from seed file, kept synthetic).
  const PEOPLE = [
    { id:"p-marcus", name:"Marcus Chen", headline:"Fractional CFO — Life Sciences & Medical Devices",
      role_category:"executive", availability:"fractional", years_experience:18,
      sectors_of_interest:["life_sciences","advanced_manufacturing"], stage_preference:["seed","series_a"],
      role_titles_seeking:["cfo","fractional_exec"], skills:["financial modeling","fundraising","fda compliance accounting","budgeting","audit prep"],
      comp_expectation_type:"salary_plus_equity", comp_min_salary_usd:150000, comp_min_equity_pct:0.5,
      location_city:"Salt Lake City", remote_ok:true, primary_network:"operator",
      university_affiliations:["University of Utah"], mission_keywords:["healthcare","patient outcomes"], risk_tolerance:"medium",
      bio:"18 years in life sciences finance. Took one diagnostics company through Series B and exit. Open to 2–3 fractional CFO engagements.",
      trust_badges:["U of U Alum","Verified CPA","Prior Exit"]},
    { id:"p-sarah", name:"Sarah Patel", headline:"Founder-track CEO seeking AI cofounder role",
      role_category:"executive", availability:"full_time", years_experience:12,
      sectors_of_interest:["ai","software"], stage_preference:["idea","pre_seed","seed"],
      role_titles_seeking:["ceo","cofounder"], skills:["go-to-market","product strategy","sales leadership","fundraising"],
      comp_expectation_type:"salary_plus_equity", comp_min_salary_usd:180000, comp_min_equity_pct:5,
      location_city:"Provo", remote_ok:false, primary_network:"operator",
      university_affiliations:["Brigham Young University"], mission_keywords:["AI for good","applied AI","automation"], risk_tolerance:"high",
      bio:"Two-time founder, one acquisition. Looking for a deep-tech AI cofounder situation in Utah; will lead GTM and operations.",
      trust_badges:["BYU Alum","2× Founder","Prior Exit"]},
    { id:"p-daniel", name:"Daniel Kim", headline:"CTO — Defense / Aerospace systems",
      role_category:"executive", availability:"full_time", years_experience:20,
      sectors_of_interest:["defense_aerospace"], stage_preference:["seed","series_a","growth"],
      role_titles_seeking:["cto"], skills:["systems engineering","rf design","embedded firmware","itar","secret clearance"],
      comp_expectation_type:"salary_plus_equity", comp_min_salary_usd:220000, comp_min_equity_pct:1,
      location_city:"Ogden", remote_ok:false, primary_network:"operator",
      mission_keywords:["national defense","aerospace innovation"], risk_tolerance:"medium",
      bio:"20 years in primes. Active TS clearance. Want to be employee #5 at a defense or space startup near Hill AFB.",
      trust_badges:["TS Clearance","Hill AFB Alum"]},
    { id:"p-rebecca", name:"Rebecca Lopez", headline:"COO — Fintech & SaaS scaling",
      role_category:"executive", availability:"full_time", years_experience:15,
      sectors_of_interest:["fintech","software"], stage_preference:["series_a","growth"],
      role_titles_seeking:["coo","fractional_exec"], skills:["operations","scaling teams","compliance","vendor management"],
      comp_expectation_type:"salary_plus_equity", comp_min_salary_usd:200000,
      location_city:"Salt Lake City", remote_ok:false, primary_network:"operator",
      mission_keywords:["financial inclusion","fintech for SMB"], risk_tolerance:"medium",
      trust_badges:["Verified Operator"]},
    { id:"p-james", name:"James O'Connor", headline:"Cofounder — energy / cleantech",
      role_category:"executive", availability:"full_time", years_experience:14,
      sectors_of_interest:["energy","advanced_manufacturing"], stage_preference:["idea","pre_seed"],
      role_titles_seeking:["cofounder","ceo"], skills:["geothermal engineering","energy markets","fundraising","team building"],
      comp_expectation_type:"salary_plus_equity", comp_min_salary_usd:150000, comp_min_equity_pct:10,
      location_city:"Logan", remote_ok:false, primary_network:"operator",
      university_affiliations:["Utah State University"], mission_keywords:["climate","decarbonization","geothermal"], risk_tolerance:"high",
      bio:"Energy market guy. Want to cofound a cleantech startup. Will take low cash for high equity.",
      trust_badges:["USU Alum","Cleantech Specialist"]},
    { id:"p-priya", name:"Priya Iyer", headline:"ML Engineer — applied AI / production LLMs",
      role_category:"operator", availability:"full_time", years_experience:8,
      sectors_of_interest:["ai","software","fintech"], stage_preference:["seed","series_a"],
      role_titles_seeking:["engineer"], skills:["pytorch","llm fine-tuning","rag","python","kubernetes","vector databases"],
      comp_expectation_type:"salary_plus_equity", comp_min_salary_usd:200000, comp_min_equity_pct:0.25,
      location_city:"Lehi", remote_ok:true, primary_network:"operator",
      mission_keywords:["responsible AI","applied ml"], risk_tolerance:"medium",
      trust_badges:["Verified Engineer"]},
    { id:"p-tom", name:"Tom Bradshaw", headline:"Senior Cybersecurity Engineer (ICS/OT)",
      role_category:"operator", availability:"full_time", years_experience:11,
      sectors_of_interest:["cyber","energy","advanced_manufacturing"], stage_preference:["seed","series_a"],
      role_titles_seeking:["engineer"], skills:["ics security","ot security","python","siem","incident response","cissp"],
      comp_expectation_type:"salary", comp_min_salary_usd:180000,
      location_city:"Salt Lake City", remote_ok:true, primary_network:"operator",
      mission_keywords:["critical infrastructure","national security"], risk_tolerance:"medium",
      trust_badges:["CISSP","GICSP"]},
    { id:"p-aisha", name:"Aisha Rahman", headline:"Fractional COO — Manufacturing operations",
      role_category:"executive", availability:"fractional", years_experience:16,
      sectors_of_interest:["advanced_manufacturing","defense_aerospace"], stage_preference:["seed","series_a"],
      role_titles_seeking:["coo","fractional_exec"], skills:["lean manufacturing","supply chain","iso 9001","quality systems"],
      comp_expectation_type:"salary_plus_equity", comp_min_salary_usd:130000,
      location_city:"Ogden", remote_ok:true, primary_network:"operator",
      mission_keywords:["manufacturing reshoring","operational excellence"], risk_tolerance:"medium",
      trust_badges:["ISO 9001 Lead Auditor"]},
    { id:"p-jenna", name:"Jenna Holcombe", headline:"Enterprise sales — life sciences / medical devices",
      role_category:"operator", availability:"full_time", years_experience:10,
      sectors_of_interest:["life_sciences"], stage_preference:["seed","series_a","growth"],
      role_titles_seeking:["sales","biz_dev"], skills:["enterprise sales","hospital sales","medical device sales","salesforce"],
      comp_expectation_type:"salary_plus_equity", comp_min_salary_usd:140000,
      location_city:"Salt Lake City", remote_ok:false, primary_network:"operator",
      mission_keywords:["healthcare","patient outcomes"], risk_tolerance:"medium",
      trust_badges:["Closer (5+ enterprise)"]},
    { id:"p-eli", name:"Eli Hart", headline:"Mentor — repeat SaaS founder, Lehi corridor",
      role_category:"mentor", availability:"advisory", years_experience:22,
      sectors_of_interest:["software","fintech","ai"], stage_preference:["pre_seed","seed"],
      role_titles_seeking:["other"], skills:["product strategy","fundraising","mentorship","saas pricing"],
      comp_expectation_type:"free",
      location_city:"Lehi", remote_ok:true, primary_network:"mentor",
      mission_keywords:["founder support","saas"], risk_tolerance:"medium",
      trust_badges:["3× Founder","Lehi Corridor"]},
    { id:"p-maya", name:"Dr. Maya Nguyen", headline:"SME Advisor — clinical regulatory / FDA",
      role_category:"advisor", availability:"advisory", years_experience:24,
      sectors_of_interest:["life_sciences"], stage_preference:["pre_seed","seed","series_a"],
      role_titles_seeking:["regulatory"], skills:["fda submissions","clinical trials","quality systems","510(k)","de novo"],
      comp_expectation_type:"equity",
      location_city:"Salt Lake City", remote_ok:true, primary_network:"sme_advisor",
      mission_keywords:["medical devices","regulatory"], risk_tolerance:"low",
      trust_badges:["Former FDA","30+ submissions"]},
    { id:"p-clay", name:"Clay Burton", headline:"Angel investor — Utah deep tech",
      role_category:"investor", availability:"advisory", years_experience:0,
      sectors_of_interest:["defense_aerospace","energy","advanced_manufacturing","ai","life_sciences"], stage_preference:["seed","series_a"],
      role_titles_seeking:["other"], skills:["due diligence","term sheet review","portfolio support"],
      comp_expectation_type:"equity",
      location_city:"Park City", remote_ok:true, primary_network:"venture",
      mission_keywords:["utah deep tech"], risk_tolerance:"high",
      trust_badges:["Lead Investor","Utah-Only Focus"],
      investor_profile:{ investor_type:"angel", typical_check_size:"500k_2m", portfolio_size:32, utah_only:true, lead_check:true }},
    { id:"p-rachel", name:"Rachel Foster", headline:"Angel syndicate lead — software & fintech",
      role_category:"investor", availability:"advisory", years_experience:0,
      sectors_of_interest:["software","fintech","ai"], stage_preference:["pre_seed","seed"],
      role_titles_seeking:["other"], skills:["syndicate management","due diligence"],
      comp_expectation_type:"equity",
      location_city:"Lehi", remote_ok:true, primary_network:"venture",
      mission_keywords:["smb","fintech"], risk_tolerance:"high",
      trust_badges:["Syndicate Lead"],
      investor_profile:{ investor_type:"syndicate", typical_check_size:"25k_100k", portfolio_size:25, utah_only:false, lead_check:false }},
    { id:"p-cassidy", name:"Cassidy Legal LLC", headline:"Startup-friendly legal — incorporation, IP, fundraising",
      role_category:"service_provider", availability:"fractional", years_experience:0,
      sectors_of_interest:["software","ai","life_sciences","fintech"], stage_preference:["idea","pre_seed","seed","series_a"],
      role_titles_seeking:["other"], skills:["incorporation","ip filings","term sheets","saas contracts"],
      comp_expectation_type:"salary",
      location_city:"Salt Lake City", remote_ok:true, primary_network:"service_provider",
      mission_keywords:["startup-friendly legal"], risk_tolerance:"low",
      trust_badges:["Startup-Friendly Terms"]}
  ];

  const STARTUPS = [
    { id:"s-helixcura", name:"HelixCura", one_liner:"AI-driven sepsis diagnostics for ICU teams",
      sector:"life_sciences", sectors_secondary:["ai"], stage:"seed", funding_status:"seed",
      total_raised_usd:3500000, team_size:9, location_city:"Salt Lake City", remote_ok:false,
      origin:"university_lab_uofu",
      roles_needed:["ceo","regulatory","biz_dev"], role_categories_open_to:["executive","advisor","investor"],
      availability_open_to:["full_time","fractional","advisory"],
      seeking_investment:true, target_raise_usd:6000000,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:170000,
      required_skills:["fda submissions","regulatory strategy","fundraising"],
      mission_keywords:["healthcare","patient outcomes","diagnostics"],
      university_lab_origin:"U of U Tech Transfer",
      trust_badges:["U of U Spinout","NSF SBIR"],
      description:"Spun out of U of U Tech Transfer. Closing seed; ramping clinical pilots." },
    { id:"s-biofortis", name:"BioFortis", one_liner:"Precision oncology diagnostics for community hospitals",
      sector:"life_sciences", sectors_secondary:[], stage:"pre_seed", funding_status:"pre_seed",
      total_raised_usd:800000, team_size:5, location_city:"Provo", remote_ok:false,
      roles_needed:["cfo","regulatory","ceo"], role_categories_open_to:["executive","advisor","investor"],
      availability_open_to:["full_time","fractional","advisory"],
      seeking_investment:true,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:140000,
      required_skills:["financial modeling","fundraising","fda submissions"],
      mission_keywords:["oncology","patient outcomes"],
      trust_badges:["BYU Spinout"] },
    { id:"s-synapse", name:"Synapse Verify", one_liner:"AI-powered KYC verification for community banks",
      sector:"ai", sectors_secondary:["fintech","software"], stage:"seed", funding_status:"seed",
      total_raised_usd:2200000, team_size:7, location_city:"Lehi", remote_ok:true,
      roles_needed:["sales","cofounder","biz_dev"], role_categories_open_to:["executive","operator","investor"],
      availability_open_to:["full_time"],
      seeking_investment:true,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:200000,
      required_skills:["enterprise sales","saas sales","go-to-market"],
      mission_keywords:["financial inclusion","applied AI"],
      trust_badges:["YC W24"] },
    { id:"s-mira", name:"Mira Health AI", one_liner:"Clinical decision support copilots for nurses",
      sector:"ai", sectors_secondary:["life_sciences","software"], stage:"pre_seed", funding_status:"pre_seed",
      total_raised_usd:600000, team_size:4, location_city:"Salt Lake City", remote_ok:true,
      roles_needed:["cto","regulatory","engineer"], role_categories_open_to:["executive","operator","advisor"],
      availability_open_to:["full_time","advisory"],
      seeking_investment:true,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:210000,
      required_skills:["pytorch","llm fine-tuning","rag"],
      mission_keywords:["healthcare","applied AI","responsible AI"],
      trust_badges:["U of U Spinout"] },
    { id:"s-skybound", name:"Skybound Systems", one_liner:"Autonomous logistics drones for the DoD",
      sector:"defense_aerospace", sectors_secondary:[], stage:"seed", funding_status:"seed",
      total_raised_usd:4500000, team_size:14, location_city:"Ogden", remote_ok:false,
      roles_needed:["biz_dev","regulatory","engineer"], role_categories_open_to:["executive","operator","advisor","investor"],
      availability_open_to:["full_time","advisory"],
      seeking_investment:true,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:220000,
      required_skills:["dod contracting","rf design","itar"],
      mission_keywords:["national defense","aerospace innovation"],
      trust_badges:["AFWERX","SBIR Phase II"] },
    { id:"s-aethernav", name:"AetherNav", one_liner:"GPS-denied navigation for drone swarms",
      sector:"defense_aerospace", sectors_secondary:["ai"], stage:"idea", funding_status:"bootstrapped",
      total_raised_usd:0, team_size:3, location_city:"Logan", remote_ok:false,
      roles_needed:["cofounder","ceo","engineer"], role_categories_open_to:["executive","operator","investor"],
      availability_open_to:["full_time"],
      seeking_investment:true,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:140000,
      required_skills:["systems engineering","rf design","fundraising"],
      mission_keywords:["national defense","aerospace innovation"],
      trust_badges:["USU Spinout"] },
    { id:"s-sentinel", name:"Sentinel ICS", one_liner:"OT security for utilities and critical infrastructure",
      sector:"cyber", sectors_secondary:["energy"], stage:"seed", funding_status:"seed",
      total_raised_usd:3000000, team_size:8, location_city:"Salt Lake City", remote_ok:true,
      roles_needed:["sales","engineer","biz_dev"], role_categories_open_to:["executive","operator"],
      availability_open_to:["full_time"],
      seeking_investment:false,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:200000,
      required_skills:["ics security","ot security","utility sales"],
      mission_keywords:["critical infrastructure","national security"],
      trust_badges:["Pilot w/ RMP"] },
    { id:"s-lumen", name:"LumenGrid", one_liner:"Distributed energy market software for utilities",
      sector:"energy", sectors_secondary:["software"], stage:"seed", funding_status:"seed",
      total_raised_usd:2700000, team_size:9, location_city:"Provo", remote_ok:true,
      roles_needed:["cto","biz_dev","engineer"], role_categories_open_to:["executive","operator","advisor"],
      availability_open_to:["full_time","advisory"],
      seeking_investment:true,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:210000,
      required_skills:["energy markets","grid integration","utility sales"],
      mission_keywords:["climate","decarbonization"],
      trust_badges:["DOE ARPA-E"] },
    { id:"s-hotrock", name:"HotRock Geo", one_liner:"Closed-loop geothermal for industrial heat",
      sector:"energy", sectors_secondary:["advanced_manufacturing"], stage:"pre_seed", funding_status:"pre_seed",
      total_raised_usd:500000, team_size:4, location_city:"Logan", remote_ok:false,
      roles_needed:["engineer","cofounder"], role_categories_open_to:["executive","operator","investor"],
      availability_open_to:["full_time"],
      seeking_investment:true,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:155000,
      required_skills:["geothermal engineering","energy markets","fundraising"],
      mission_keywords:["climate","decarbonization","geothermal"],
      trust_badges:["USU Spinout"] },
    { id:"s-forgeops", name:"ForgeOps", one_liner:"Connected-factory software for mid-market mfg",
      sector:"advanced_manufacturing", sectors_secondary:["software"], stage:"seed", funding_status:"seed",
      total_raised_usd:3100000, team_size:11, location_city:"Ogden", remote_ok:true,
      roles_needed:["sales","biz_dev","engineer","coo"], role_categories_open_to:["executive","operator"],
      availability_open_to:["full_time","fractional"],
      seeking_investment:false,
      comp_offered_type:"salary_plus_equity", comp_max_salary_usd:185000,
      required_skills:["lean manufacturing","supply chain","saas sales"],
      mission_keywords:["manufacturing reshoring","operational excellence"],
      trust_badges:["Pilot w/ Tier-1 Auto"] }
  ];

  // ── Mock matching engine (mirrors RuleFilter): hard filters + 7-dim soft scoring ──
  function intersect(a, b) { const s = new Set(a||[]); return (b||[]).filter(x => s.has(x)); }
  function jacc(a, b) {
    const A = new Set(a||[]); const B = new Set(b||[]);
    if (!A.size && !B.size) return 0;
    const inter = [...A].filter(x => B.has(x)).length;
    const uni = new Set([...A, ...B]).size;
    return uni ? inter/uni : 0;
  }
  function tokenOverlap(a, b) {
    const A = new Set((a||[]).map(s => s.toLowerCase()));
    const B = new Set((b||[]).map(s => s.toLowerCase()));
    if (!A.size || !B.size) return 0;
    const inter = [...A].filter(x => B.has(x)).length;
    return Math.min(1, inter / Math.min(A.size, B.size));
  }
  const STAGE_RISK = { idea:"high", pre_seed:"high", seed:"medium", series_a:"medium", growth:"low" };

  function computeMatch(person, startup) {
    const reasons = [], blockers = [];
    let pass = true;

    // Hard filters
    if (!(startup.availability_open_to||[]).includes(person.availability)) {
      blockers.push(`Availability mismatch: needs ${person.availability}, startup wants ${(startup.availability_open_to||[]).join("/")}`);
      pass = false;
    }
    if (!(startup.role_categories_open_to||[]).includes(person.role_category)) {
      blockers.push(`Role category mismatch: ${person.role_category} not in opening`);
      pass = false;
    }
    if (person.comp_expectation_type !== "free" && person.comp_min_salary_usd && startup.comp_max_salary_usd) {
      if (startup.comp_max_salary_usd < person.comp_min_salary_usd) {
        blockers.push(`Salary gap: $${person.comp_min_salary_usd.toLocaleString()} > $${startup.comp_max_salary_usd.toLocaleString()}`);
        pass = false;
      }
    }

    // Soft scoring
    const role = intersect(person.role_titles_seeking, startup.roles_needed).length /
                 Math.max(1, (startup.roles_needed||[]).length);
    const sectorSet = [startup.sector, ...(startup.sectors_secondary||[])];
    const sector = intersect(person.sectors_of_interest, sectorSet).length > 0
                 ? Math.min(1, intersect(person.sectors_of_interest, sectorSet).length / Math.max(1, sectorSet.length) + 0.4)
                 : 0;
    const stage = (person.stage_preference||[]).includes(startup.stage) ? 1 : 0;
    const reqMatch = intersect(person.skills, startup.required_skills).length /
                     Math.max(1, (startup.required_skills||[]).length);
    const skill = Math.min(1, reqMatch);
    const mission = tokenOverlap(person.mission_keywords, startup.mission_keywords);
    const location = person.location_city === startup.location_city ? 1
                   : (person.remote_ok || startup.remote_ok ? 0.6 : 0.3);
    const personRisk = person.risk_tolerance || "medium";
    const startupRisk = STAGE_RISK[startup.stage] || "medium";
    const risk = personRisk === startupRisk ? 1 : 0.5;

    // Default weights (executive/operator). Mentor/advisor variants below.
    let w = { role:0.25, sector:0.20, stage:0.10, skill:0.20, mission:0.10, location:0.10, risk:0.05 };
    if (person.role_category === "mentor")  w = { role:0, sector:0.5, stage:0, skill:0, mission:0.5, location:0, risk:0 };
    if (person.role_category === "advisor") w = { role:0.3, sector:0.3, stage:0.2, skill:0, mission:0.2, location:0, risk:0 };
    if (person.role_category === "investor"){ w = { role:0, sector:0.4, stage:0.3, skill:0, mission:0.15, location:0.05, risk:0.10 }; }

    const dims = { role, sector, stage, skill, mission, location, risk };
    const score = pass ? Object.keys(w).reduce((a,k) => a + (dims[k]||0) * w[k], 0) : 0;

    if (sector >= 0.7) reasons.push(`Strong sector overlap: ${SECTOR_LABEL[startup.sector]}`);
    if (role >= 0.5)   reasons.push(`Role fit — ${intersect(person.role_titles_seeking, startup.roles_needed).join(", ")}`);
    if (skill >= 0.5)  reasons.push(`Skill match: ${intersect(person.skills, startup.required_skills).slice(0,3).join(", ")}`);
    if (mission >= 0.5)reasons.push(`Aligned mission keywords`);
    if (stage)         reasons.push(`Stage preference includes ${STAGE_LABEL[startup.stage]}`);
    if (location === 1)reasons.push(`Same city (${startup.location_city})`);

    return {
      talent_id: person.id, startup_id: startup.id,
      score: Math.max(0, Math.min(1, score)),
      passed_hard_filters: pass,
      dimension_scores: dims, reasons, blockers,
      matcher: "rule_filter (mock)"
    };
  }

  function rankPersonToStartups(person, opts={}) {
    const { topK=10, sectorFilter=[] } = opts;
    let pool = STARTUPS;
    if (sectorFilter.length) {
      pool = pool.filter(s => sectorFilter.includes(s.sector) || (s.sectors_secondary||[]).some(x => sectorFilter.includes(x)));
    }
    const all = pool.map(s => ({ ...computeMatch(person, s), startup: s }));
    return all.sort((a,b) => b.score - a.score).slice(0, topK);
  }
  function rankStartupToPeople(startup, opts={}) {
    const { topK=10 } = opts;
    const all = PEOPLE.map(p => ({ ...computeMatch(p, startup), person: p }));
    return all.sort((a,b) => b.score - a.score).slice(0, topK);
  }
  // Compare-all-matchers: mock by perturbing weights to simulate an embedding/agentic variant.
  function compareMatchers(person, opts) {
    const base = rankPersonToStartups(person, opts);
    const embed = rankPersonToStartups({ ...person,
      // pretend embedding emphasizes mission + skill semantically
      mission_keywords: [...(person.mission_keywords||[]), ...(person.skills||[]).slice(0,3)]
    }, opts).map(m => ({ ...m, matcher:"embedding (mock)", score: Math.min(1, m.score*0.85 + 0.1) }));
    const agent = base.map(m => ({ ...m, matcher:"agentic (mock)", score: Math.min(1, m.score*0.75 + (m.passed_hard_filters?0.18:0)) }))
                       .sort((a,b)=>b.score-a.score);
    return {
      rule_filter: base,
      embedding:   embed.sort((a,b)=>b.score-a.score),
      agentic:     agent
    };
  }

  // Fake "connection graph": warmth weight 0..1 — university shared, sector overlap, prior_companies overlap.
  function connections(personId) {
    const me = PEOPLE.find(p => p.id === personId);
    if (!me) return [];
    return PEOPLE.filter(p => p.id !== personId).map(p => {
      let w = 0;
      if (intersect(me.sectors_of_interest, p.sectors_of_interest).length) w += 0.35;
      if (intersect(me.university_affiliations, p.university_affiliations).length) w += 0.30;
      if (me.location_city === p.location_city) w += 0.20;
      if (intersect(me.mission_keywords, p.mission_keywords).length) w += 0.15;
      return { person: p, warmth: Math.min(1, w) };
    }).filter(x => x.warmth > 0).sort((a,b) => b.warmth - a.warmth);
  }

  // ── API client (live → mock fallback) ─────────────────────────────────────
  async function tryLive(url, opts) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) { return null; }
  }

  const api = {
    base: localStorage.getItem("nucleus.api") || "http://localhost:8765",
    setBase(b) { this.base = b; localStorage.setItem("nucleus.api", b); },

    async ping() {
      const r = await tryLive(`${this.base}/health`);
      return r ? { live:true, info:r } : { live:false };
    },

    async listPeople()   { return PEOPLE; },
    async listStartups() { return STARTUPS; },
    async getPerson(id)  { return PEOPLE.find(p => p.id === id); },
    async getStartup(id) { return STARTUPS.find(s => s.id === id); },

    async matchPerson(personId, { topK=10, sectorFilter=[], matcher } = {}) {
      // Try live first
      const live = await tryLive(`${this.base}/api/v1/match/talent/${personId}?top_k=${topK}${matcher?`&matcher=${matcher}`:""}`,
                                  { method:"POST" });
      if (live && live.matches) return { source:"live", matches: live.matches, talent: live.talent };
      const me = PEOPLE.find(p => p.id === personId);
      return { source:"mock", matches: rankPersonToStartups(me, { topK, sectorFilter }), talent: me };
    },
    async matchStartup(startupId, { topK=10 } = {}) {
      const live = await tryLive(`${this.base}/api/v1/match/startup/${startupId}?top_k=${topK}`, { method:"POST" });
      if (live && live.matches) return { source:"live", matches: live.matches, startup: live.startup };
      const s = STARTUPS.find(x => x.id === startupId);
      return { source:"mock", matches: rankStartupToPeople(s, { topK }), startup: s };
    },
    async compare(personId, { topK=10 } = {}) {
      const live = await tryLive(`${this.base}/api/v1/match/talent/${personId}/compare?top_k=${topK}`, { method:"POST" });
      if (live && live.by_matcher) return { source:"live", by_matcher: live.by_matcher };
      const me = PEOPLE.find(p => p.id === personId);
      return { source:"mock", by_matcher: compareMatchers(me, { topK }) };
    },
    connections,
  };

  // expose globally
  window.NX = { SECTORS, SECTOR_LABEL, NETWORK_LABEL, STAGE_LABEL, PEOPLE, STARTUPS, api,
                rankPersonToStartups, rankStartupToPeople, computeMatch, connections, compareMatchers };
})();
