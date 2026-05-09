"""Procedural synthetic profile generator.

Augments the curated `nucleus_seed.json` with hundreds of additional
Utah-flavored Talent and Startup profiles. Deterministic — same RNG seed
on every boot — so the dataset is stable across restarts and tests.

Generated emails are namespaced under `@nucleus-synth.example.com` to
guarantee uniqueness against the curated entries.

Returns plain dicts (not ORM objects) so `seed_if_empty` can run them
through Pydantic validation just like the JSON-loaded entries.
"""

from __future__ import annotations

import random
from typing import Any

_RNG_SEED = 20260508
_DOMAIN = "nucleus-synth.example.com"


# ---------- Pools ----------

FIRST_NAMES: list[str] = [
    "Aaron", "Abby", "Adam", "Adrian", "Aisha", "Alana", "Alex", "Alice", "Allison", "Amanda",
    "Amir", "Amy", "Andre", "Andrew", "Angela", "Anika", "Anil", "Anna", "Anthony", "Ariana",
    "Arjun", "Ashley", "Audrey", "Austin", "Ava", "Beatriz", "Ben", "Bethany", "Bianca", "Brad",
    "Brandon", "Brianna", "Brooke", "Bryce", "Caleb", "Cameron", "Camila", "Carlos", "Carmen",
    "Caroline", "Carter", "Cassidy", "Catherine", "Cesar", "Chaim", "Chase", "Chelsea", "Chen",
    "Chloe", "Chris", "Claire", "Claudia", "Cody", "Connor", "Cooper", "Daisuke", "Damian",
    "Daniel", "Danielle", "Darius", "David", "Dawit", "Deepa", "Derek", "Devon", "Diana",
    "Diego", "Dimitri", "Dmitri", "Dominique", "Eitan", "Elena", "Eli", "Elise", "Elizabeth",
    "Emanuel", "Emily", "Emma", "Eric", "Erin", "Esteban", "Ethan", "Eva", "Evelyn", "Faisal",
    "Fatima", "Felipe", "Fernando", "Francesca", "Gabriel", "Gabriela", "Genevieve", "George",
    "Grace", "Hadley", "Hana", "Hannah", "Harish", "Hassan", "Hayden", "Heidi", "Helen",
    "Henry", "Hiroshi", "Hugo", "Ibrahim", "Ines", "Isabel", "Isaiah", "Ivan", "Jack",
    "Jackson", "Jacob", "Jaden", "Jamal", "James", "Jamie", "Jana", "Jared", "Jasmine",
    "Jason", "Jasper", "Javier", "Jaya", "Jeffrey", "Jenna", "Jennifer", "Jesse", "Jessica",
    "Jin", "Jiwon", "Joaquin", "Joel", "John", "Jonas", "Jonathan", "Jordan", "Jorge", "Jose",
    "Joseph", "Joshua", "Josephine", "Julia", "Julian", "Julianna", "Justin", "Kaito",
    "Kara", "Karina", "Karthik", "Kasey", "Kate", "Katherine", "Kayla", "Keisha", "Kelvin",
    "Kenji", "Kevin", "Khalid", "Kim", "Kira", "Klara", "Kofi", "Krish", "Kyle", "Lance",
    "Lara", "Laura", "Lauren", "Layla", "Lena", "Leo", "Leslie", "Liam", "Lila", "Lily",
    "Linda", "Logan", "Lorenzo", "Lucas", "Lucia", "Luis", "Maddie", "Mae", "Maeve", "Maggie",
    "Maha", "Maia", "Malia", "Malik", "Marcus", "Maria", "Mariana", "Marie", "Mark", "Martin",
    "Mary", "Mateo", "Matias", "Matthew", "Maya", "Megan", "Melissa", "Mei", "Michael",
    "Mikael", "Miles", "Min", "Mira", "Mitsuko", "Mohammed", "Monica", "Morgan", "Nadia",
    "Naomi", "Natalia", "Nathan", "Neha", "Niall", "Nicholas", "Nicole", "Nina", "Noah",
    "Nora", "Olga", "Olivia", "Omar", "Owen", "Pablo", "Paige", "Paolo", "Patrick", "Paula",
    "Peter", "Phillip", "Pia", "Pilar", "Priya", "Quinn", "Rachel", "Rafael", "Raj", "Ramon",
    "Raquel", "Rashad", "Rebecca", "Reza", "Riley", "Rina", "Roberto", "Robin", "Roman",
    "Rosa", "Ruby", "Ryan", "Sabrina", "Sahil", "Salma", "Samantha", "Samuel", "Sara",
    "Sarah", "Sasha", "Scott", "Sean", "Selena", "Sergio", "Shane", "Shauna", "Shawn",
    "Shreya", "Sienna", "Simon", "Sofia", "Sophie", "Stefan", "Stephanie", "Stuart", "Sunita",
    "Suzanne", "Sydney", "Tanvi", "Tara", "Taylor", "Tessa", "Thiago", "Thomas", "Tiana",
    "Tobias", "Tomas", "Tony", "Travis", "Tyler", "Uma", "Valentina", "Vanessa", "Veronica",
    "Victor", "Vikram", "Vincent", "Vivian", "Wade", "Walter", "Wei", "Wendy", "Wesley",
    "William", "Wyatt", "Xander", "Xavier", "Xin", "Yara", "Yasmin", "Yejin", "Yelena",
    "Youssef", "Yuki", "Yusuf", "Zachary", "Zara", "Zoe", "Zola",
]

LAST_NAMES: list[str] = [
    "Abbott", "Adams", "Aguilar", "Ahmadi", "Ahmed", "Ali", "Allen", "Alvarez", "Andersen",
    "Anderson", "Andrade", "Arias", "Armstrong", "Arnold", "Bailey", "Baker", "Barker",
    "Barnes", "Barrera", "Bell", "Bennett", "Berg", "Bishop", "Black", "Blake", "Bloom",
    "Boyd", "Bradley", "Brewer", "Brock", "Brooks", "Brown", "Bryant", "Burke", "Burns",
    "Butler", "Cabrera", "Caldwell", "Calhoun", "Cameron", "Campbell", "Cano", "Carlson",
    "Carter", "Castillo", "Castro", "Chan", "Chandra", "Chang", "Chapman", "Chavez", "Chen",
    "Cheng", "Cho", "Choi", "Chowdhury", "Christensen", "Clark", "Clarke", "Cohen", "Coleman",
    "Collins", "Conrad", "Cook", "Cooper", "Cortes", "Cox", "Cruz", "Cunningham", "Da Silva",
    "Dalton", "Daniels", "Davies", "Davis", "Delgado", "Diaz", "Dixon", "Dominguez", "Donovan",
    "Douglas", "Doyle", "Duarte", "Dunn", "Dyer", "Edwards", "Eklund", "Ellis", "Erickson",
    "Eriksson", "Espinoza", "Estes", "Evans", "Farrell", "Fernandez", "Ferreira", "Ferrari",
    "Fields", "Fischer", "Fisher", "Flores", "Foster", "Fox", "Franco", "Frank", "Franklin",
    "Freeman", "Fuentes", "Fuller", "Gamble", "Garcia", "Gardner", "Garrett", "Garza",
    "George", "Gibson", "Gill", "Gomez", "Gonzales", "Gonzalez", "Gordon", "Graham", "Grant",
    "Gray", "Greene", "Griffin", "Gupta", "Gutierrez", "Hahn", "Hale", "Hall", "Hamilton",
    "Han", "Hansen", "Harper", "Harrington", "Harris", "Hart", "Hassan", "Hawkins", "Hayes",
    "Henderson", "Hendricks", "Hernandez", "Herrera", "Higgins", "Hill", "Ho", "Hodges",
    "Holcombe", "Holland", "Holmes", "Hopkins", "Horton", "Howard", "Howell", "Hsu", "Huang",
    "Hudson", "Hughes", "Humphrey", "Hunt", "Hussain", "Iqbal", "Islam", "Jackson", "Jacobs",
    "James", "Jansen", "Jefferson", "Jenkins", "Jensen", "Jeong", "Jimenez", "Johansson",
    "Johnson", "Jones", "Joshi", "Kapoor", "Kaur", "Kaya", "Keller", "Kennedy", "Khan",
    "Kim", "King", "Klein", "Knight", "Ko", "Kobayashi", "Kowalski", "Krishnan", "Kumar",
    "Kwon", "Lam", "Lambert", "Lane", "Larsen", "Larson", "Le", "Lee", "Leon", "Levy",
    "Lewis", "Li", "Liang", "Lin", "Lindholm", "Lindqvist", "Liu", "Long", "Lopez", "Lozano",
    "Luna", "Lyons", "Ma", "Mack", "Madison", "Maguire", "Mahmoud", "Malik", "Mancuso",
    "Mansour", "Marin", "Marsh", "Marshall", "Martin", "Martinez", "Mason", "Mathews",
    "Matsuda", "Matthews", "May", "McBride", "McCarthy", "McCoy", "McDonald", "McKinney",
    "Medina", "Mehta", "Melendez", "Mendez", "Mendoza", "Mercado", "Meyer", "Miller",
    "Mills", "Mitchell", "Miyamoto", "Mohammed", "Molina", "Monroe", "Montgomery", "Moon",
    "Moore", "Morales", "Moreno", "Morgan", "Morris", "Morrison", "Mukherjee", "Murakami",
    "Murillo", "Murphy", "Murray", "Nair", "Nakamura", "Navarro", "Nelson", "Newton",
    "Nguyen", "Nielsen", "Nieves", "Nilsson", "Norris", "North", "Novak", "O'Brien",
    "O'Connor", "Okafor", "Okonkwo", "Olsen", "Ortiz", "Owens", "Padilla", "Page", "Palmer",
    "Park", "Parker", "Patel", "Paul", "Pearson", "Pedersen", "Pena", "Perez", "Perkins",
    "Perry", "Petersen", "Peterson", "Petrov", "Pham", "Phillips", "Pierce", "Pope", "Powell",
    "Prasad", "Preston", "Price", "Quinn", "Radford", "Ramirez", "Ramos", "Ramsey", "Rao",
    "Rasmussen", "Reed", "Reese", "Reeves", "Reid", "Reyes", "Reynolds", "Rhodes", "Ribeiro",
    "Rice", "Richards", "Rios", "Rivera", "Rivers", "Robbins", "Roberts", "Robinson", "Rocha",
    "Rodriguez", "Rogers", "Rojas", "Rosales", "Ross", "Rossi", "Rowe", "Ruiz", "Russell",
    "Ryan", "Saito", "Salas", "Salazar", "Sanchez", "Sanders", "Sanderson", "Santiago",
    "Santos", "Sato", "Saunders", "Schmidt", "Schneider", "Schultz", "Schwartz", "Scott",
    "Sequeira", "Serrano", "Shah", "Sharma", "Shaw", "Shen", "Sheppard", "Shimizu", "Silva",
    "Simmons", "Simon", "Sinclair", "Singh", "Sloan", "Smith", "Snow", "Snyder", "Soto",
    "Spencer", "Stein", "Stephens", "Stevens", "Stewart", "Stokes", "Strickland", "Stuart",
    "Suarez", "Sullivan", "Sun", "Suzuki", "Tanaka", "Tang", "Taylor", "Terry", "Thomas",
    "Thompson", "Thornton", "Thorson", "Tian", "Tomlinson", "Torres", "Tran", "Trinh",
    "Truong", "Tucker", "Turner", "Underwood", "Valdez", "Valencia", "Vance", "Vang",
    "Vargas", "Vasquez", "Vazquez", "Velasquez", "Wagner", "Walker", "Wallace", "Walsh",
    "Walter", "Wang", "Ward", "Warren", "Washington", "Watanabe", "Watson", "Watts", "Weaver",
    "Webb", "Webber", "Weber", "Weiss", "Welch", "Wells", "West", "Westbrook", "Whitaker",
    "White", "Whitney", "Wilcox", "Williams", "Williamson", "Wilson", "Winters", "Wong",
    "Woods", "Wright", "Wu", "Xie", "Xu", "Yamamoto", "Yang", "Yates", "Yeo", "Yoo",
    "Yoshida", "Young", "Yu", "Zambrano", "Zamora", "Zhang", "Zhao", "Zheng", "Zhou", "Zhu",
]

CITIES_UT: list[tuple[str, str]] = [
    ("Salt Lake City", "Wasatch Front"),
    ("Provo", "Utah Valley"),
    ("Lehi", "Silicon Slopes"),
    ("Ogden", "Northern Utah"),
    ("Logan", "Cache Valley"),
    ("Park City", "Wasatch Back"),
    ("St. George", "Southern Utah"),
    ("Sandy", "Wasatch Front"),
    ("Draper", "Silicon Slopes"),
    ("Murray", "Wasatch Front"),
    ("Orem", "Utah Valley"),
    ("Bountiful", "Wasatch Front"),
    ("Layton", "Northern Utah"),
    ("West Valley City", "Wasatch Front"),
    ("Cedar City", "Southern Utah"),
    ("Heber City", "Wasatch Back"),
    ("South Jordan", "Silicon Slopes"),
    ("American Fork", "Utah Valley"),
    ("Pleasant Grove", "Utah Valley"),
    ("Spanish Fork", "Utah Valley"),
    ("Riverton", "Wasatch Front"),
    ("Holladay", "Wasatch Front"),
]

UNIVERSITIES: list[str] = [
    "University of Utah",
    "Brigham Young University",
    "Utah State University",
    "Weber State University",
    "Utah Valley University",
    "Westminster College",
    "Southern Utah University",
    "Dixie State University",
]

ACCELERATORS: list[str] = [
    "Lassonde Studios",
    "BYU Innovate",
    "USU Aggie I-Corps",
    "Beehive Startups",
    "Kiln",
    "Silicon Slopes Hub",
    "Park City Tech Center",
    "USTAR",
    "Tech-Moms Utah",
]

UTAH_NETWORKS: list[str] = [
    "Silicon Slopes",
    "Utah Tech Council",
    "Women Tech Council",
    "BioUtah",
    "Utah Defense Manufacturing Community",
    "Utah Clean Energy",
    "U Tech Transfer",
    "BYU Tech Transfer",
    "Lassonde Studios",
]

# ---------- Sector vocabularies ----------

SECTORS: list[str] = [
    "life_sciences", "ai", "defense_aerospace", "cyber",
    "energy", "advanced_manufacturing", "fintech", "software",
]

SECTOR_SKILLS: dict[str, list[str]] = {
    "life_sciences": [
        "wet lab", "molecular biology", "cell culture", "fda submissions", "510k",
        "clinical trial design", "regulatory strategy", "gmp", "iso 13485", "elisa",
        "pcr", "biostatistics", "proteomics", "genomics", "bioinformatics",
        "medical device design", "histology", "immunology", "drug discovery",
    ],
    "ai": [
        "pytorch", "tensorflow", "llm fine-tuning", "rag", "vector databases",
        "transformers", "computer vision", "nlp", "mlops", "reinforcement learning",
        "model evaluation", "prompt engineering", "agentic systems", "embeddings",
        "distributed training", "inference optimization",
    ],
    "defense_aerospace": [
        "rf design", "avionics", "matlab", "signal processing", "itar", "ts clearance",
        "secret clearance", "embedded firmware", "systems engineering", "dod contracting",
        "defense procurement", "satellite systems", "mission planning", "guidance systems",
        "radar", "uas operations", "trajectory optimization",
    ],
    "cyber": [
        "ics security", "ot security", "incident response", "siem", "cissp", "gicsp",
        "penetration testing", "threat hunting", "zero trust", "soc 2", "fedramp",
        "cryptography", "reverse engineering", "malware analysis", "iam",
    ],
    "energy": [
        "energy markets", "grid integration", "energy storage", "geothermal engineering",
        "solar pv", "wind", "transmission planning", "der orchestration", "utility sales",
        "power systems", "scada", "battery chemistry", "demand response",
    ],
    "advanced_manufacturing": [
        "lean manufacturing", "supply chain", "iso 9001", "quality systems",
        "cnc", "additive manufacturing", "robotics", "plc programming", "solidworks",
        "automation", "industrial iot", "metrology", "tooling design",
    ],
    "fintech": [
        "payments", "underwriting", "compliance", "kyc/aml", "open banking",
        "core banking", "card networks", "embedded finance", "lending operations",
        "fraud", "credit risk modeling", "treasury",
    ],
    "software": [
        "typescript", "react", "node", "python", "go", "rust", "kubernetes",
        "postgres", "developer tools", "ci/cd", "aws", "gcp", "system design",
        "graphql", "redis", "observability",
    ],
}

ROLE_SKILLS: dict[str, list[str]] = {
    "ceo": ["fundraising", "go-to-market", "team building", "vision setting", "investor relations"],
    "coo": ["operations", "scaling teams", "vendor management", "process design"],
    "cto": ["systems engineering", "tech strategy", "engineering leadership", "architecture"],
    "cfo": ["financial modeling", "fundraising", "fp&a", "audit prep", "budgeting"],
    "fractional_exec": ["fractional leadership", "interim management", "scaling teams"],
    "engineer": [],
    "sales": ["enterprise sales", "saas sales", "outbound prospecting", "salesforce", "pipeline"],
    "marketing": ["content marketing", "seo", "paid acquisition", "lifecycle marketing", "abm"],
    "biz_dev": ["partnerships", "channel", "rfp response", "deal structuring"],
    "regulatory": ["fda submissions", "regulatory strategy", "510k", "compliance"],
    "product": ["product strategy", "discovery", "roadmapping", "user research"],
    "design": ["figma", "design systems", "user research", "prototype testing"],
}

SECTOR_MISSIONS: dict[str, list[str]] = {
    "life_sciences": ["healthcare", "patient outcomes", "diagnostics", "rare diseases", "patient safety"],
    "ai": ["AI for good", "applied AI", "responsible AI", "automation", "applied ml"],
    "defense_aerospace": ["national defense", "aerospace innovation", "autonomy", "space"],
    "cyber": ["critical infrastructure", "national security", "privacy", "trust"],
    "energy": ["climate", "decarbonization", "clean energy", "grid modernization", "geothermal"],
    "advanced_manufacturing": ["manufacturing", "reshoring", "operational excellence", "industrial innovation"],
    "fintech": ["financial inclusion", "fintech for SMB", "smb empowerment", "credit access"],
    "software": ["developer experience", "applied ml", "developer tools", "open source"],
}

SECTOR_PRIOR_COMPANIES: dict[str, list[str]] = {
    "life_sciences": ["Myriad Genetics", "ARUP Laboratories", "BioFire", "Recursion", "Idaho Technology", "Edwards Lifesciences", "Becton Dickinson"],
    "ai": ["Recursion", "Domo", "Pluralsight", "Weights & Biases", "Scale AI", "Databricks"],
    "defense_aerospace": ["Lockheed Martin", "Northrop Grumman", "L3Harris", "Hill AFB", "Raytheon", "Boeing", "Aerojet Rocketdyne"],
    "cyber": ["Tenable", "Proofpoint", "Venafi", "Palo Alto Networks", "CrowdStrike"],
    "energy": ["Rocky Mountain Power", "Energy Solutions", "PacifiCorp", "Schweitzer Engineering"],
    "advanced_manufacturing": ["Autoliv", "Boeing", "Hexcel", "Cytiva", "Northrop Grumman"],
    "fintech": ["MX", "Galileo", "Finicity", "Goldman Sachs", "Plaid"],
    "software": ["Qualtrics", "Domo", "Pluralsight", "InsideSales", "Adobe", "Workday"],
}

SECTOR_STARTUP_NAME_PARTS: dict[str, tuple[list[str], list[str]]] = {
    "life_sciences": (["Helio", "Cura", "Bio", "Vita", "Genome", "Pulse", "Aria", "Lumen", "Theia", "Med", "Onco", "Nova", "Plasma", "Reva"], ["Health", "Bio", "Dx", "Genomics", "Med", "Therapeutics", "Sciences", "Care", "Cell", "Labs"]),
    "ai": (["Nebula", "Synapse", "Cortex", "Mira", "Alto", "Lumen", "Echo", "Vector", "Tensor", "Reason", "Atlas", "Glyph", "Fable", "Ember"], ["AI", "ML", "Mind", "Reason", "Logic", "Sense", "Vector", "Stack", "Cloud", "OS"]),
    "defense_aerospace": (["Skybound", "Aether", "Beacon", "Sentinel", "Vanguard", "Apex", "Talon", "Orion", "Polaris", "Rampart", "Helios", "Anvil"], ["Systems", "Aerospace", "Dynamics", "Defense", "Aviation", "Avionics", "Tech", "Industries"]),
    "cyber": (["Sentinel", "Cipher", "Aegis", "Bastion", "Helix", "Ward", "Citadel", "Glyph", "Vault", "Locknet"], ["Sec", "Security", "Defense", "Cyber", "Trust", "Net", "Guard", "ICS"]),
    "energy": (["Lumen", "HotRock", "Watt", "Solstice", "Kilowatt", "Photon", "Spark", "Aurora", "Helios", "Kinet"], ["Energy", "Grid", "Power", "Geo", "Storage", "Renewables", "Systems"]),
    "advanced_manufacturing": (["Forge", "Anvil", "Iron", "Blueprint", "Atlas", "Beacon", "Riveted", "Foundry"], ["Ops", "Works", "Industries", "Mfg", "Robotics", "Automation", "Systems"]),
    "fintech": (["Stag", "Tally", "Ledger", "Beacon", "Cardinal", "Strata", "Mint", "Vault"], ["Pay", "Capital", "Finance", "Lending", "Bank", "Treasury", "Books", "Rails"]),
    "software": (["Nimbus", "Nebula", "Beacon", "Quark", "Glyph", "Ember", "Caldera", "Loom", "Atlas", "Drift"], ["Trace", "Stack", "Labs", "Cloud", "OS", "DB", "Tools", "Hub", "Works"]),
}

# ---------- Utilities ----------


def _make_email(rng: random.Random, first: str, last: str, idx: int) -> str:
    base = f"{first}.{last}".lower().replace(" ", "").replace("'", "")
    return f"{base}{idx:04d}@{_DOMAIN}"


def _pick_city(rng: random.Random) -> tuple[str, str]:
    return rng.choice(CITIES_UT)


def _pick_skills(rng: random.Random, sectors: list[str], role_titles: list[str], k_min: int, k_max: int) -> list[str]:
    pool: list[str] = []
    for s in sectors:
        pool.extend(SECTOR_SKILLS.get(s, []))
    for t in role_titles:
        pool.extend(ROLE_SKILLS.get(t, []))
    pool = list(dict.fromkeys(pool))  # dedupe, preserve order
    if not pool:
        pool = SECTOR_SKILLS["software"]
    k = rng.randint(k_min, min(k_max, len(pool)))
    return rng.sample(pool, k)


def _pick_missions(rng: random.Random, sectors: list[str], k_min: int = 1, k_max: int = 3) -> list[str]:
    pool: list[str] = []
    for s in sectors:
        pool.extend(SECTOR_MISSIONS.get(s, []))
    pool = list(dict.fromkeys(pool))
    k = rng.randint(k_min, min(k_max, len(pool)))
    return rng.sample(pool, k)


def _maybe(rng: random.Random, p: float) -> bool:
    return rng.random() < p


# ---------- Talent generators ----------


def _gen_executive(rng: random.Random, idx: int) -> dict[str, Any]:
    title = rng.choices(
        ["ceo", "coo", "cto", "cfo", "fractional_exec", "cofounder"],
        weights=[3, 2, 3, 2, 2, 2],
    )[0]
    sector = rng.choice(SECTORS)
    secondary = [s for s in rng.sample(SECTORS, 2) if s != sector][:1]
    sectors_of_interest = [sector] + secondary
    titles = [title] + (["fractional_exec"] if rng.random() < 0.25 and title != "fractional_exec" else [])
    full_time = title != "fractional_exec" and _maybe(rng, 0.7)
    availability = "full_time" if full_time else ("fractional" if title == "fractional_exec" or _maybe(rng, 0.5) else "advisory")

    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    name = f"{first} {last}"
    city, metro = _pick_city(rng)

    years = rng.randint(10, 28)
    skills = _pick_skills(rng, sectors_of_interest, [title], 4, 8)
    salary_min = rng.choice([130000, 150000, 170000, 190000, 220000, 250000])
    equity_min = round(rng.choice([0.25, 0.5, 1.0, 2.0, 4.0, 6.0]), 2)

    education = []
    if _maybe(rng, 0.7):
        education.append({
            "school": rng.choice(UNIVERSITIES),
            "degree": rng.choice(["MBA", "MS", "BS"]),
            "field": rng.choice(["Finance", "Engineering", "Computer Science", "Business", "Strategy"]),
            "graduation_year": rng.randint(1995, 2020),
        })

    profile: dict[str, Any] = {
        "name": name,
        "email": _make_email(rng, first, last, idx),
        "headline": f"{title.upper().replace('_', ' ')} — {sector.replace('_', ' ').title()}",
        "role_category": "executive",
        "role_titles_seeking": titles,
        "availability": availability,
        "skills": skills,
        "sectors_of_interest": sectors_of_interest,
        "stage_preference": rng.choice([["pre_seed", "seed"], ["seed", "series_a"], ["series_a", "growth"], ["seed", "series_a", "growth"]]),
        "years_experience": years,
        "prior_titles": rng.sample(["VP Operations", "VP Product", "Engineering Director", "Director of FP&A", "Chief of Staff", "Principal Engineer", "Head of Sales"], rng.randint(1, 3)),
        "prior_companies": rng.sample(SECTOR_PRIOR_COMPANIES.get(sector, []), min(2, len(SECTOR_PRIOR_COMPANIES.get(sector, [])))),
        "prior_exits": rng.choices([0, 1, 2, 3], weights=[5, 4, 2, 1])[0],
        "education": education,
        "comp_expectation_type": "salary_plus_equity",
        "comp_min_salary_usd": salary_min,
        "comp_min_equity_pct": equity_min,
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": _maybe(rng, 0.55),
        "willing_to_relocate": _maybe(rng, 0.15),
        "mission_keywords": _pick_missions(rng, sectors_of_interest),
        "risk_tolerance": rng.choices(["low", "medium", "high"], weights=[1, 5, 3])[0],
        "primary_network": "operator",
    }
    if _maybe(rng, 0.4):
        profile["university_affiliations"] = [rng.choice(UNIVERSITIES)]
    return profile


def _gen_operator(rng: random.Random, idx: int) -> dict[str, Any]:
    role = rng.choices(
        ["engineer", "sales", "marketing", "biz_dev", "regulatory", "product", "design"],
        weights=[8, 3, 3, 2, 1, 2, 1],
    )[0]
    sector = rng.choice(SECTORS)
    secondary = [s for s in rng.sample(SECTORS, 2) if s != sector][:rng.randint(0, 1)]
    sectors_of_interest = [sector] + secondary

    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    name = f"{first} {last}"
    city, metro = _pick_city(rng)

    years = rng.randint(2, 14)
    skills = _pick_skills(rng, sectors_of_interest, [role], 3, 7)
    base_salary = {"engineer": 150000, "sales": 130000, "marketing": 120000, "biz_dev": 130000, "regulatory": 140000, "product": 140000, "design": 110000}[role]
    salary_min = base_salary + rng.randint(-20000, 40000)

    profile: dict[str, Any] = {
        "name": name,
        "email": _make_email(rng, first, last, idx),
        "headline": f"{role.replace('_', ' ').title()} — {sector.replace('_', ' ').title()}",
        "role_category": "operator",
        "role_titles_seeking": [role] + ([rng.choice(["biz_dev", "sales"])] if role in ("sales", "biz_dev") and _maybe(rng, 0.4) else []),
        "availability": "full_time" if _maybe(rng, 0.85) else rng.choice(["part_time", "fractional"]),
        "skills": skills,
        "sectors_of_interest": sectors_of_interest,
        "stage_preference": rng.choice([["seed"], ["seed", "series_a"], ["series_a", "growth"], ["pre_seed", "seed"]]),
        "years_experience": years,
        "comp_expectation_type": rng.choice(["salary", "salary_plus_equity"]),
        "comp_min_salary_usd": salary_min,
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": _maybe(rng, 0.55),
        "mission_keywords": _pick_missions(rng, sectors_of_interest),
        "risk_tolerance": rng.choices(["low", "medium", "high"], weights=[2, 5, 3])[0],
        "primary_network": "operator",
    }
    if _maybe(rng, 0.35):
        profile["university_affiliations"] = [rng.choice(UNIVERSITIES)]
    if profile["comp_expectation_type"] == "salary_plus_equity":
        profile["comp_min_equity_pct"] = round(rng.choice([0.05, 0.1, 0.15, 0.25, 0.5]), 2)
    return profile


def _gen_student(rng: random.Random, idx: int) -> dict[str, Any]:
    sector = rng.choice(SECTORS)
    school = rng.choice(UNIVERSITIES)
    field_by_sector = {
        "life_sciences": "Bioengineering", "ai": "Computer Science", "defense_aerospace": "Mechanical Engineering",
        "cyber": "Computer Science", "energy": "Mechanical Engineering", "advanced_manufacturing": "Mechanical Engineering",
        "fintech": "Finance", "software": "Computer Science",
    }
    field = field_by_sector.get(sector, "Computer Science")
    degree = rng.choices(["BS", "MS", "PhD"], weights=[7, 2, 1])[0]
    years = 0 if degree == "BS" else rng.randint(0, 3)

    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    city, metro = _pick_city(rng)

    role = "engineer" if sector in ("ai", "cyber", "software", "defense_aerospace") else rng.choice(["engineer", "other"])
    skills = _pick_skills(rng, [sector], [role], 2, 5)

    profile: dict[str, Any] = {
        "name": f"{first} {last}",
        "email": _make_email(rng, first, last, idx),
        "headline": f"{school.split()[0]} {field} {degree.lower()}",
        "role_category": "student",
        "role_titles_seeking": [role],
        "availability": rng.choice(["internship", "part_time"]),
        "skills": skills,
        "sectors_of_interest": [sector],
        "stage_preference": rng.choice([["pre_seed", "seed"], ["seed"], ["seed", "series_a"]]),
        "years_experience": years,
        "education": [{
            "school": school,
            "degree": degree,
            "field": field,
            "graduation_year": rng.randint(2026, 2029),
        }],
        "comp_expectation_type": "salary",
        "comp_min_salary_usd": rng.randint(20, 65),
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": _maybe(rng, 0.5),
        "mission_keywords": _pick_missions(rng, [sector], 1, 2),
        "risk_tolerance": "high",
        "primary_network": "operator",
        "university_affiliations": [school],
    }
    if school == "University of Utah" and _maybe(rng, 0.4):
        profile["utah_networks"] = ["Lassonde Studios"]
    return profile


def _gen_intern(rng: random.Random, idx: int) -> dict[str, Any]:
    sector = rng.choice(SECTORS)
    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    city, metro = _pick_city(rng)
    skills = _pick_skills(rng, [sector], ["engineer"], 2, 4)

    return {
        "name": f"{first} {last}",
        "email": _make_email(rng, first, last, idx),
        "headline": f"{sector.replace('_', ' ').title()} intern — {rng.choice(['undergrad', 'bootcamp grad', 'recent grad'])}",
        "role_category": "intern",
        "role_titles_seeking": ["engineer"] if sector in ("ai", "cyber", "software") else ["engineer", "other"],
        "availability": "internship",
        "skills": skills,
        "sectors_of_interest": [sector],
        "stage_preference": ["seed", "series_a"],
        "years_experience": 0,
        "comp_expectation_type": "salary",
        "comp_min_salary_usd": rng.randint(18, 35),
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": _maybe(rng, 0.6),
        "mission_keywords": _pick_missions(rng, [sector], 1, 2),
        "risk_tolerance": "high",
        "primary_network": "operator",
    }


def _gen_board_member(rng: random.Random, idx: int) -> dict[str, Any]:
    sector = rng.choice(SECTORS)
    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    city, metro = _pick_city(rng)
    skills = (_pick_skills(rng, [sector], [], 2, 4) + ["governance", "fundraising", "exits"])[:6]
    exits = rng.choices([1, 2, 3], weights=[4, 3, 2])[0]
    return {
        "name": f"{first} {last}",
        "email": _make_email(rng, first, last, idx),
        "headline": f"Independent board member — {sector.replace('_', ' ').title()}",
        "role_category": "board_member",
        "role_titles_seeking": ["other"],
        "availability": "advisory",
        "hours_per_week_min": 4,
        "hours_per_week_max": 10,
        "skills": skills,
        "sectors_of_interest": [sector],
        "stage_preference": rng.choice([["seed", "series_a"], ["series_a", "growth"], ["seed", "series_a", "growth"]]),
        "years_experience": rng.randint(20, 35),
        "prior_titles": ["CEO", "Board Director"],
        "prior_companies": rng.sample(SECTOR_PRIOR_COMPANIES.get(sector, []), min(2, len(SECTOR_PRIOR_COMPANIES.get(sector, [])))),
        "prior_exits": exits,
        "comp_expectation_type": "equity",
        "comp_min_equity_pct": round(rng.choice([0.25, 0.5, 0.75, 1.0]), 2),
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": True,
        "mission_keywords": _pick_missions(rng, [sector]),
        "risk_tolerance": "low",
        "primary_network": "sme_advisor",
        "trust_badges": [f"{exits}x exits", "former CEO"] if exits > 0 else ["former CEO"],
    }


def _gen_advisor(rng: random.Random, idx: int) -> dict[str, Any]:
    sector = rng.choice(SECTORS)
    role = rng.choice(["regulatory", "sales", "biz_dev", "product", "marketing", "other"])
    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    city, metro = _pick_city(rng)
    skills = _pick_skills(rng, [sector], [role], 3, 6)
    return {
        "name": f"{first} {last}",
        "email": _make_email(rng, first, last, idx),
        "headline": f"Advisor — {sector.replace('_', ' ').title()} {role.replace('_', ' ')}",
        "role_category": "advisor",
        "role_titles_seeking": [role],
        "availability": "advisory",
        "hours_per_week_min": 2,
        "hours_per_week_max": 6,
        "skills": skills,
        "sectors_of_interest": [sector],
        "stage_preference": rng.choice([["pre_seed", "seed"], ["seed", "series_a"], ["pre_seed", "seed", "series_a"]]),
        "years_experience": rng.randint(15, 30),
        "comp_expectation_type": "equity",
        "comp_min_equity_pct": round(rng.choice([0.1, 0.25, 0.5]), 2),
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": True,
        "mission_keywords": _pick_missions(rng, [sector]),
        "risk_tolerance": rng.choice(["low", "medium"]),
        "primary_network": "sme_advisor",
    }


def _gen_mentor(rng: random.Random, idx: int) -> dict[str, Any]:
    sector = rng.choice(SECTORS)
    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    city, metro = _pick_city(rng)
    exits = rng.choices([0, 1, 2, 3], weights=[2, 4, 3, 1])[0]
    return {
        "name": f"{first} {last}",
        "email": _make_email(rng, first, last, idx),
        "headline": f"Mentor — {sector.replace('_', ' ').title()} founder coaching",
        "role_category": "mentor",
        "role_titles_seeking": ["other"],
        "availability": "advisory",
        "hours_per_week_min": 1,
        "hours_per_week_max": 3,
        "skills": _pick_skills(rng, [sector], [], 2, 4) + ["founder coaching"],
        "sectors_of_interest": [sector],
        "stage_preference": ["idea", "pre_seed", "seed"],
        "years_experience": rng.randint(15, 32),
        "prior_exits": exits,
        "comp_expectation_type": "free",
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": True,
        "mission_keywords": _pick_missions(rng, [sector], 1, 2) + ["founder coaching"],
        "risk_tolerance": "medium",
        "primary_network": "mentor",
        "trust_badges": [f"{exits}x exit founder"] if exits else [],
    }


def _gen_investor(rng: random.Random, idx: int) -> dict[str, Any]:
    investor_type = rng.choices(
        ["angel", "vc", "syndicate", "family_office", "corporate_vc"],
        weights=[5, 4, 2, 2, 1],
    )[0]
    check = rng.choice(["under_25k", "25k_100k", "100k_500k", "500k_2m", "2m_plus"])
    n_sectors = rng.randint(1, 4)
    sectors_focus = rng.sample(SECTORS, n_sectors)
    stages = rng.choice([["pre_seed", "seed"], ["seed", "series_a"], ["series_a", "growth"], ["pre_seed", "seed", "series_a"]])
    first = rng.choice(FIRST_NAMES)
    last = rng.choice(LAST_NAMES)
    city, metro = _pick_city(rng)
    return {
        "name": f"{first} {last}",
        "email": _make_email(rng, first, last, idx),
        "headline": f"{investor_type.replace('_', ' ').title()} — {', '.join(s.replace('_', ' ') for s in sectors_focus[:2])}",
        "role_category": "investor",
        "role_titles_seeking": ["other"],
        "availability": "advisory",
        "skills": ["due diligence", "term sheets"] + (["board governance"] if investor_type == "vc" else []),
        "sectors_of_interest": sectors_focus,
        "stage_preference": stages,
        "comp_expectation_type": "equity",
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": True,
        "mission_keywords": _pick_missions(rng, sectors_focus, 1, 2) + ["utah ecosystem"],
        "risk_tolerance": rng.choice(["medium", "high"]),
        "primary_network": "venture",
        "investor_profile": {
            "investor_type": investor_type,
            "typical_check_size": check,
            "stages_invested": stages,
            "sectors_focused": sectors_focus,
            "portfolio_size": rng.randint(5, 60),
            "utah_only": _maybe(rng, 0.4),
            "lead_check": investor_type in ("vc", "family_office") and _maybe(rng, 0.6),
        },
    }


def _gen_service_provider(rng: random.Random, idx: int) -> dict[str, Any]:
    service_type = rng.choice(["legal", "creative", "operational", "technical", "financial", "marketing", "recruiting"])
    sector = rng.choice(SECTORS)
    n_sectors = rng.randint(2, 4)
    sectors_served = rng.sample(SECTORS, n_sectors)
    first = rng.choice(["Wasatch", "Beehive", "Cottonwood", "Provo", "Lehi", "Granite", "Bonneville", "Aspen", "Cache", "Summit"])
    last = rng.choice(["Advisory", "Partners", "Studio", "Group", "Co", "Collective", "Works", "LLC", "Lab"])
    city, metro = _pick_city(rng)
    firm = f"{first} {last}"

    skills_by_service = {
        "legal": ["incorporation", "ip filings", "term sheets", "saas contracts", "patents"],
        "creative": ["brand identity", "web design", "pitch deck design", "figma", "illustration"],
        "operational": ["process design", "scaling teams", "vendor management"],
        "technical": ["aws", "kubernetes", "ci/cd", "security", "fractional cto"],
        "financial": ["bookkeeping", "financial reporting", "cash flow", "quickbooks"],
        "marketing": ["content marketing", "seo", "paid acquisition", "lifecycle marketing"],
        "recruiting": ["technical recruiting", "executive search", "talent operations"],
    }
    return {
        "name": firm,
        "email": f"hello@{first.lower()}-{service_type}-{idx:04d}.example.com",
        "headline": f"{service_type.title()} services for early-stage Utah startups",
        "role_category": "service_provider",
        "role_titles_seeking": ["other"],
        "availability": "fractional",
        "skills": skills_by_service[service_type],
        "sectors_of_interest": sectors_served,
        "stage_preference": ["idea", "pre_seed", "seed", "series_a"],
        "comp_expectation_type": "salary",
        "comp_min_salary_usd": rng.choice([20000, 30000, 50000, 75000, 100000]),
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": True,
        "mission_keywords": [f"startup-friendly {service_type}"],
        "risk_tolerance": "low",
        "primary_network": "service_provider",
        "service_provider_profile": {
            "service_type": service_type,
            "firm_name": firm,
            "startup_friendly_terms": _maybe(rng, 0.85),
            "stages_served": ["pre_seed", "seed", "series_a"],
            "sectors_served": sectors_served,
        },
    }


# ---------- Startup generator ----------


def _gen_startup(rng: random.Random, idx: int) -> dict[str, Any]:
    sector = rng.choice(SECTORS)
    secondary_count = rng.randint(0, 2)
    sectors_secondary = [s for s in rng.sample(SECTORS, max(secondary_count + 1, 1)) if s != sector][:secondary_count]

    first_parts, second_parts = SECTOR_STARTUP_NAME_PARTS[sector]
    name = f"{rng.choice(first_parts)}{rng.choice(second_parts)}"
    if _maybe(rng, 0.2):
        name = f"{name} {rng.choice(['Labs', 'AI', 'Systems', 'Bio', 'Works'])}"

    origin = rng.choices(
        ["bootstrapped", "vc_backed", "university_lab_uofu", "university_lab_byu", "university_lab_usu", "grant_funded"],
        weights=[4, 5, 2, 2, 2, 1],
    )[0]
    stage = rng.choices(["idea", "pre_seed", "seed", "series_a", "growth"], weights=[2, 3, 5, 3, 1])[0]
    funding_status = {
        "idea": "bootstrapped", "pre_seed": rng.choice(["bootstrapped", "grants", "pre_seed"]),
        "seed": "seed", "series_a": "series_a", "growth": "series_b_plus",
    }[stage]

    raise_targets = {"idea": 250000, "pre_seed": 1000000, "seed": 3000000, "series_a": 10000000, "growth": 30000000}
    total_raised_buckets = {"idea": 0, "pre_seed": 250000, "seed": 1500000, "series_a": 8000000, "growth": 25000000}

    team_size = {"idea": rng.randint(1, 3), "pre_seed": rng.randint(2, 6), "seed": rng.randint(5, 15), "series_a": rng.randint(15, 45), "growth": rng.randint(40, 120)}[stage]
    trl = rng.randint(2, 5) if sector in ("life_sciences", "defense_aerospace", "energy", "advanced_manufacturing") else None

    roles_pool = ["ceo", "cto", "coo", "cfo", "engineer", "sales", "marketing", "biz_dev", "regulatory", "product", "design", "cofounder"]
    roles_needed = rng.sample(roles_pool, rng.randint(2, 4))

    open_to_pool = ["executive", "operator", "advisor", "board_member", "mentor", "investor", "service_provider"]
    role_categories_open_to = rng.sample(open_to_pool, rng.randint(3, 5))

    avail_pool = ["full_time", "part_time", "fractional", "advisory", "internship"]
    availability_open_to = rng.sample(avail_pool, rng.randint(2, 3))

    seeking_inv = stage in ("idea", "pre_seed", "seed", "series_a") and _maybe(rng, 0.7)
    target_checks = rng.sample(["under_25k", "25k_100k", "100k_500k", "500k_2m", "2m_plus"], rng.randint(1, 3))

    required = _pick_skills(rng, [sector] + sectors_secondary, [roles_needed[0]] if roles_needed else [], 3, 6)
    nice = _pick_skills(rng, [sector], [], 2, 4)

    city, metro = _pick_city(rng)

    profile: dict[str, Any] = {
        "name": f"{name} {idx:04d}",
        "one_liner": _make_one_liner(rng, sector),
        "description": _make_description(rng, sector, stage, origin),
        "sector": sector,
        "sectors_secondary": sectors_secondary,
        "origin": origin,
        "founded_year": rng.randint(2018, 2025),
        "stage": stage,
        "funding_status": funding_status,
        "total_raised_usd": int(total_raised_buckets[stage] * rng.uniform(0.5, 1.5)) if stage != "idea" else 0,
        "team_size": team_size,
        "roles_needed": roles_needed,
        "role_categories_open_to": role_categories_open_to,
        "availability_open_to": availability_open_to,
        "urgency": rng.choices(["immediate", "next_quarter", "exploring"], weights=[5, 3, 2])[0],
        "advisor_slots_open": rng.randint(0, 3),
        "comp_offered_type": rng.choice(["salary_plus_equity", "salary", "equity"]),
        "comp_min_salary_usd": rng.choice([90000, 110000, 130000, 150000]),
        "comp_max_salary_usd": rng.choice([180000, 210000, 240000, 280000]),
        "comp_max_equity_pct": round(rng.choice([0.5, 1.0, 2.0, 4.0, 6.0, 10.0, 20.0]), 2),
        "seeking_investment": seeking_inv,
        "required_skills": required,
        "nice_to_have_skills": nice,
        "location_city": city,
        "location_state": "UT",
        "location_metro": metro,
        "remote_ok": _maybe(rng, 0.5),
        "mission_keywords": _pick_missions(rng, [sector] + sectors_secondary),
        "risk_profile": rng.choices(["low", "medium", "high"], weights=[1, 5, 4])[0],
    }
    if trl is not None:
        profile["trl_level"] = trl
    if seeking_inv:
        profile["target_raise_usd"] = int(raise_targets[stage] * rng.uniform(0.7, 1.5))
        profile["target_check_sizes"] = target_checks
        profile["seeking_lead"] = _maybe(rng, 0.4)
    if origin == "university_lab_uofu":
        profile["university_lab_origin"] = rng.choice(["U of U Tech Transfer", "U of U Bioengineering", "U of U Health Sciences"])
    elif origin == "university_lab_byu":
        profile["university_lab_origin"] = rng.choice(["BYU Innovate", "BYU Engineering"])
    elif origin == "university_lab_usu":
        profile["university_lab_origin"] = rng.choice(["USU Aerospace", "USU Energy Dynamics Lab", "USU Ag Tech"])
    if _maybe(rng, 0.4):
        profile["accelerator_affiliations"] = [rng.choice(ACCELERATORS)]
    if origin == "grant_funded" or _maybe(rng, 0.25):
        profile["recent_grants"] = [rng.choice(["NIH SBIR Phase I", "NIH SBIR Phase II", "DOE ARPA-E", "AFWERX", "NSF SBIR", "DOD STTR"])]
    return profile


def _make_one_liner(rng: random.Random, sector: str) -> str:
    templates = {
        "life_sciences": ["AI-driven {x} for {y}", "Targeted {x} for {y}", "Point-of-care {x} for {y}"],
        "ai": ["Autonomous AI agents for {x}", "LLM-powered {x} for {y}", "Foundation model {x} for {y}"],
        "defense_aerospace": ["{x} for {y} platforms", "GPS-denied {x} for {y}", "Edge-AI {x} for {y}"],
        "cyber": ["{x} security monitoring for {y}", "Zero-trust {x} for {y}", "OT/ICS {x} for {y}"],
        "energy": ["{x} orchestration for {y}", "Distributed {x} for {y}", "Enhanced {x} systems"],
        "advanced_manufacturing": ["{x} analytics for {y}", "Robotics-driven {x} for {y}", "{x} for shop floors"],
        "fintech": ["{x} + working capital for {y}", "Embedded {x} for {y}", "{x} infrastructure for {y}"],
        "software": ["{x} observability for {y}", "Open-core {x} for {y}", "Developer-first {x} platform"],
    }
    x_pool = {
        "life_sciences": ["sepsis diagnostics", "gene therapy", "oncology dx", "wearable monitoring", "clinical decision support"],
        "ai": ["fraud detection", "code generation", "knowledge retrieval", "voice agents", "document understanding"],
        "defense_aerospace": ["ISR", "navigation", "comms", "tactical autonomy", "EW countermeasures"],
        "cyber": ["industrial control", "cloud workload", "identity", "supply chain", "endpoint"],
        "energy": ["grid", "geothermal", "battery storage", "demand response", "DER"],
        "advanced_manufacturing": ["operational", "additive manufacturing", "CNC", "metrology", "inspection"],
        "fintech": ["payments", "lending", "treasury", "credit", "AR/AP"],
        "software": ["distributed-tracing", "feature-flag", "data-pipeline", "vector-search", "build-system"],
    }
    y_pool = {
        "life_sciences": ["ICU teams", "primary care", "rare-disease patients", "research labs", "hospital systems"],
        "ai": ["enterprise teams", "developers", "fintech", "compliance teams", "support orgs"],
        "defense_aerospace": ["small UAS", "tactical teams", "satellite ops", "DoD primes"],
        "cyber": ["utilities", "manufacturers", "SaaS companies", "federal customers"],
        "energy": ["utilities", "co-ops", "industrial customers", "rural grids"],
        "advanced_manufacturing": ["job shops", "tier-1 suppliers", "aerospace mfg", "automotive"],
        "fintech": ["SMB contractors", "early-stage businesses", "embedded apps", "underbanked SMBs"],
        "software": ["AI workloads", "platform teams", "DevOps", "data teams"],
    }
    template = rng.choice(templates[sector])
    return template.format(x=rng.choice(x_pool[sector]), y=rng.choice(y_pool[sector]))


def _make_description(rng: random.Random, sector: str, stage: str, origin: str) -> str:
    origin_phrase = {
        "bootstrapped": "Bootstrapped team",
        "vc_backed": "VC-backed",
        "university_lab_uofu": "U of U spinout",
        "university_lab_byu": "BYU-originated",
        "university_lab_usu": "USU spinout",
        "grant_funded": "Grant-funded",
    }[origin]
    return f"{origin_phrase} {stage.replace('_', ' ')} {sector.replace('_', ' ')} company. {rng.choice(['Currently iterating with design partners.', 'Pre-revenue, pursuing pilots.', 'Generating early revenue with paid pilots.', 'In active production with paying customers.'])}"


# ---------- Public API ----------


def build_synthetic_batch(
    *,
    n_executives: int = 60,
    n_operators: int = 100,
    n_students: int = 35,
    n_interns: int = 20,
    n_board_members: int = 18,
    n_advisors: int = 25,
    n_mentors: int = 25,
    n_investors: int = 25,
    n_service_providers: int = 22,
    n_startups: int = 120,
) -> dict[str, list[dict[str, Any]]]:
    """Generate a deterministic batch of synthetic talents and startups.

    Defaults sum to ~330 talents + 120 startups. Emails and (where relevant)
    firm names are namespaced under nucleus-synth.example.com so they cannot
    collide with curated entries from `nucleus_seed.json`.
    """
    rng = random.Random(_RNG_SEED)
    talents: list[dict[str, Any]] = []

    spec: list[tuple[int, Any]] = [
        (n_executives, _gen_executive),
        (n_operators, _gen_operator),
        (n_students, _gen_student),
        (n_interns, _gen_intern),
        (n_board_members, _gen_board_member),
        (n_advisors, _gen_advisor),
        (n_mentors, _gen_mentor),
        (n_investors, _gen_investor),
        (n_service_providers, _gen_service_provider),
    ]

    idx = 0
    for count, fn in spec:
        for _ in range(count):
            idx += 1
            talents.append(fn(rng, idx))

    startups: list[dict[str, Any]] = []
    for i in range(n_startups):
        startups.append(_gen_startup(rng, i + 1))

    return {"talents": talents, "startups": startups}
