export type CaseStudy = {
  slug: string;
  company: string;
  /** Short title used on the project/case-study card. */
  cardName: string;
  /** Short blurb used on the card (the page uses `summary`). */
  cardBlurb: string;
  headline: string;
  role: string;
  period: string;
  location: string;
  accentLabel: string;
  tags: string[];
  summary: string;
  problem: string[];
  approach: { title: string; body: string }[];
  stack: { group: string; items: string[] }[];
  outcomes: { metric: string; label: string }[];
  image?: { src: string; alt: string; width: number; height: number };
  featured?: boolean;
};

/** Slugs shown in the "Case Studies" group on the home page (professional work). */
export const professionalCaseStudySlugs = [
  "voyage-foods-dashboard",
  "lcs-big-team",
  "jakapa-canvas-integration",
  "aef-access-migration",
];

export const caseStudies: CaseStudy[] = [
  {
    slug: "voyage-foods-dashboard",
    company: "Voyage Foods",
    cardName: "Manufacturing Ops Dashboard",
    cardBlurb:
      "A centralized React dashboard unifying Cin7 Core ERP, SafetyChain QA, and 200+ live Ignition SCADA tags into one plant-floor view with a SQLite → PostgreSQL migration powering the history layer.",
    headline: "One dashboard for the plant floor: ERP, QA, and 200+ live SCADA tags",
    role: "Computer Science Engineer Intern",
    period: "May 2026 to Aug 2026",
    location: "Mason, OH",
    accentLabel: "Industrial Systems",
    tags: ["React", "PostgreSQL", "Ignition SCADA", "OPC-UA", "Cin7 ERP", "SafetyChain"],
    summary:
      "Voyage Foods runs manufacturing lines, and the data describing them lived in four disconnected systems. I built a React dashboard that pulls ERP, QA, and live machine telemetry into one plant-floor view, and re-platformed the historical tag storage from SQLite to PostgreSQL.",
    problem: [
      "Production data was scattered across Cin7 Core ERP (orders and inventory), SafetyChain (quality assurance), and Ignition SCADA (live machine signals). To answer a simple question about plant performance, someone had to jump between three or four tools and cross-check the numbers by hand.",
      "On top of that, the historical PLC tag data lived in SQLite. That was fine for a prototype, but a bottleneck once we needed to retain and query hundreds of tags across many machines over time.",
    ],
    approach: [
      {
        title: "Unify the sources behind one interface",
        body: "I built a React dashboard that pulls from Cin7 Core ERP, SafetyChain QA, Ignition SCADA, and PostgreSQL and normalizes them into one consistent view, so the plant floor and management read the same numbers.",
      },
      {
        title: "Re-platform the tag history: SQLite → PostgreSQL",
        body: "I migrated PLC tag storage from SQLite to PostgreSQL, giving the historian a database that could keep up with the write volume and the ad-hoc queries the team ran against it.",
      },
      {
        title: "Make 200+ tags legible",
        body: "I surfaced 200+ Ignition tags across 10+ production machines as graphs and analysis views, turning raw OPC-UA signals into trends an engineer can scan and act on.",
      },
    ],
    stack: [
      { group: "Frontend", items: ["React"] },
      { group: "Data", items: ["PostgreSQL", "SQLite (legacy)"] },
      { group: "Industrial", items: ["Ignition SCADA", "Tag Historian", "OPC-UA"] },
      { group: "Integrations", items: ["Cin7 Core ERP", "SafetyChain QA"] },
    ],
    outcomes: [
      { metric: "4", label: "systems unified into one view" },
      { metric: "200+", label: "Ignition tags visualized" },
      { metric: "10+", label: "production machines monitored" },
      { metric: "SQLite→PG", label: "tag history re-platformed" },
    ],
    image: {
      src: "/voyage-dashboard-overview.svg",
      alt: "Data-flow diagram: Cin7 Core ERP, SafetyChain QA, and Ignition SCADA tags feed an ingest layer that normalizes them, tag history lands in PostgreSQL after a migration from SQLite, and a React dashboard shows live values and history as plant-floor and management views.",
      width: 1360,
      height: 460,
    },
  },
  {
    slug: "jakapa-canvas-integration",
    company: "JAKAPA",
    cardName: "JAKAPA × Canvas LMS",
    cardBlurb:
      "A full-stack Edlink integration linking an Angular ed-tech platform to Canvas: single sign-on, automatic account creation, and login-triggered roster sync mirrored into PostgreSQL.",
    headline: "Wiring an ed-tech platform into Canvas LMS with Edlink",
    role: "Full Stack Developer",
    period: "May 2023 — Jun 2025",
    location: "Remote",
    accentLabel: "Web · Integrations",
    tags: ["Angular", "Node.js", "Edlink API", "Canvas LMS", "PostgreSQL", "OAuth2"],
    summary:
      "JAKAPA is a social-emotional learning platform. To live inside teachers' existing workflows, it needed to connect to Canvas LMS so students could sign in once and reach JAKAPA without leaving the tools they already use. I built that integration end to end.",
    problem: [
      "Before the integration, JAKAPA and Canvas were two separate worlds. Students had to manage a second login, teachers had no automated roster sync, and assigned activities weren't reachable from the LMS they lived in every day.",
      "Keeping rostering and assignment data consistent between the two systems by hand wasn't viable. As usage grew, it needed to be automatic and reliable.",
    ],
    approach: [
      {
        title: "One login, no second password",
        body: "I built a full-stack Edlink API integration linking JAKAPA's Angular platform to Canvas, so a student signs in once through Edlink and lands in JAKAPA straight from Canvas with no second account or password.",
      },
      {
        title: "Automated enrollment",
        body: "The integration automatically enrolls students based on Canvas rostering, removing the manual setup teachers previously had to do for every class.",
      },
      {
        title: "Mirror rosters into Postgres",
        body: "On each Edlink login I pull the user's enrollments and classes and mirror them into PostgreSQL as groups and memberships, with idempotent upserts (ON CONFLICT DO NOTHING) so a re-sync never duplicates a student, and teachers are promoted to leaders automatically.",
      },
    ],
    stack: [
      { group: "Frontend", items: ["Angular"] },
      { group: "Backend", items: ["Node.js", "Express"] },
      { group: "Data", items: ["PostgreSQL"] },
      { group: "Integrations", items: ["Edlink API", "Canvas LMS"] },
    ],
    outcomes: [
      { metric: "SSO", label: "single sign-on from Canvas" },
      { metric: "JIT", label: "account created on first login" },
      { metric: "Auto", label: "student enrollment & roster sync" },
      { metric: "Idempotent", label: "re-sync never duplicates" },
    ],
    image: {
      src: "/jakapa-architecture.svg",
      alt: "Architecture diagram of the JAKAPA Edlink integration: a student authenticates through Edlink SSO from Canvas, the backend exchanges the code for an Edlink token, fetches the profile, resolves the district to an organization and provisions the account in one transaction, then a login-triggered roster mirror pulls Edlink enrollments and classes and upserts them idempotently into PostgreSQL.",
      width: 1360,
      height: 676,
    },
  },
  {
    slug: "aef-access-migration",
    company: "American Equity Funding, Inc.",
    cardName: "Solo Database Administration",
    cardBlurb:
      "Fourteen months as a financial company's only technical person: managing its investor and financial records, migrating legacy Microsoft Access workflows to PostgreSQL, and building Java tools so non-technical staff could work with the data safely.",
    headline: "Running a company's data as its only technical person",
    role: "Database Administrator",
    period: "Aug 2023 to Oct 2024",
    location: "Remote",
    accentLabel: "Data · Ownership",
    tags: ["Java", "PostgreSQL", "MS Access", "Data Migration"],
    summary:
      "American Equity Funding is a small financial company, and for fourteen months I was its entire technical staff. Every database question, migration, backup, and report ran through me. I managed the firm's investor and financial records, moved its legacy Microsoft Access workflows to PostgreSQL, and wrote Java tools so the rest of the team could work with the data safely.",
    problem: [
      "The company's investor and financial records lived in aging Microsoft Access files: fragile, easy to overwrite, and hard to secure. There was no engineering team behind them. When I joined, I became the engineering team.",
      "That meant no senior developer to review my work and nobody to escalate to. Integrity, security, and reporting accuracy for sensitive financial data were my responsibility alone, while the rest of the staff needed to read and update records every day without breaking anything.",
    ],
    approach: [
      {
        title: "Own the data end to end",
        body: "I handled the day-to-day administration myself: keeping investor and financial data consistent across multiple databases, answering the staff's data requests, and making sure the numbers in every report could be trusted.",
      },
      {
        title: "Migrate off Access, onto PostgreSQL",
        body: "I planned and ran the migration from legacy Microsoft Access workflows to PostgreSQL on my own, in stages, keeping the business running on live data the whole time.",
      },
      {
        title: "Build tools the staff could use safely",
        body: "I wrote Java tools that let non-technical employees query and update records without touching raw tables, so routine changes stopped depending on me and stopped risking the data.",
      },
      {
        title: "Work without a review loop",
        body: "With nobody to check my work, I built my own discipline: backups before every change, testing against copies of the data, and explaining decisions in plain language to the company's owners so they always knew what was happening and why.",
      },
    ],
    stack: [
      { group: "Tech", items: ["Java", "PostgreSQL", "MS Access (legacy)"] },
      { group: "Responsibilities", items: ["Data Integrity", "Security", "Reporting Accuracy"] },
      { group: "Ways of working", items: ["Sole Technical Owner", "Remote", "Direct to Stakeholders"] },
    ],
    outcomes: [
      { metric: "Solo", label: "the company's only technical person" },
      { metric: "14 mo", label: "owning investor data end to end" },
      { metric: "Access→PG", label: "migration planned and run alone" },
      { metric: "Self-serve", label: "Java tools for non-technical staff" },
    ],
  },
  {
    slug: "8-bit-computer",
    company: "Engineering Pathway Capstone",
    cardName: "8-Bit Programmable Computer",
    cardBlurb:
      "A physical 8-bit computer built by hand from logic gates on breadboards, an ALU, registers, RAM, a clock, and a decimal display running assembly programs with add/subtract, load, store, and jump instructions.",
    headline: "Building an 8-bit computer from logic gates, by hand",
    role: "Senior Capstone Project",
    period: "2022 — 2023",
    location: "High School Engineering Pathway",
    accentLabel: "Hardware · Digital Logic",
    tags: ["Digital Logic", "EEPROMs", "Assembly", "Breadboards", "Computer Architecture"],
    summary:
      "It started with a game. Playing Turing Complete, I built a working computer from a single NAND gate up. Once I'd made an 8-bit machine in the game, I decided to build a real one, a physical 8-bit computer wired from simple logic gates on breadboards, inspired by Ben Eater's series.",
    problem: [
      "I wanted to actually understand how a computer works, not at the level of 'the CPU runs instructions,' but down to the gates. A simulator gets you part of the way; I wanted to bridge from the game to real, debuggable hardware on a bench.",
      "That meant turning a stack of logic-gate ICs, EEPROMs, LEDs, and wire into a coherent machine: an ALU, registers, a program counter, RAM, a clock, control logic, and a display, all wired to talk to each other correctly.",
    ],
    approach: [
      {
        title: "Learn the fundamentals",
        body: "I worked through Ben Eater's guide and studied schematics and digital logic: how AND, OR, NOT, NAND, NOR, and XOR gates behave, and how microprocessor architecture executes instructions and moves data between components.",
      },
      {
        title: "Source the components",
        body: "I bought and organized the parts: logic-gate ICs, breadboards, EEPROMs, LEDs, and a lot of wire, so I had the needed materials for each subsystem.",
      },
      {
        title: "Wire, debug, repeat",
        body: "I built it incrementally, wiring a component, debugging it, and repeating, then connected each individual component into one working machine. Debugging hundreds of jumper wires by hand was the real teacher.",
      },
    ],
    stack: [
      { group: "Logic", items: ["AND / OR / NOT", "NAND / NOR / XOR"] },
      { group: "Memory", items: ["EEPROMs", "Registers", "RAM"] },
      { group: "Software", items: ["Assembly", "Binary Arithmetic"] },
      { group: "Build", items: ["Breadboards", "LEDs", "7-seg Display"] },
    ],
    outcomes: [
      { metric: "8-bit", label: "add & subtract arithmetic" },
      { metric: "Decimal", label: "7-segment numeric display" },
      { metric: "Load/Store/Jump", label: "expanded instruction set" },
      { metric: "Assembly", label: "wrote & ran real programs" },
    ],
    image: {
      src: "/8bit-computer.webp",
      alt: "The 8-bit computer built across multiple breadboards with hundreds of jumper wires",
      width: 2000,
      height: 1500,
    },
  },
  {
    slug: "lcs-big-team",
    company: "London Computer Systems",
    cardName: "Shipping on a 50+ Engineer Team",
    cardBlurb:
      "My first co-op inside a large, established codebase and a 50 plus engineer team. I resolved 30 plus production tickets across Angular, C#/.NET, and SQL, and learned how real software teams actually work.",
    headline: "What working on a big team taught me",
    role: "Full Stack Developer Co-op",
    period: "Aug 2025 to Dec 2025",
    location: "Cincinnati, OH",
    accentLabel: "Teamwork · Full-Stack",
    tags: ["Angular", "C# / .NET", "SQL", "Agile", "Code Review"],
    summary:
      "This was my first time working inside a large codebase I did not write, alongside a team of more than 50 engineers. Over the co-op I resolved 30 plus production tickets spanning bug fixes, feature work, and database updates, and the biggest thing I took away was not a framework. It was how a real engineering team operates.",
    problem: [
      "Coming in, I had built plenty of my own projects, but I had never opened a codebase this large or worked on a team this size. The real challenge was getting productive in a system I did not design, on a team with its own rhythm and standards.",
      "I needed to learn how to find my way around unfamiliar code, write changes other engineers would approve, and contribute steadily inside an Agile process without slowing anyone down.",
    ],
    approach: [
      {
        title: "Get productive in a large codebase",
        body: "I learned to navigate a big Angular, C#/.NET, and SQL system I did not write, tracing features end to end and figuring out where a change belonged before touching anything. Reading code became as important as writing it.",
      },
      {
        title: "Work to the team's standards",
        body: "Through code reviews I learned to write changes that fit the team's conventions and to take feedback well. Reviewing and being reviewed taught me more about clean, maintainable code than any tutorial had.",
      },
      {
        title: "Find the Agile rhythm",
        body: "Sprint planning, standups, and steady delivery inside a 50 plus engineer team showed me how large efforts stay coordinated. I learned when to ask a good question instead of spinning my wheels, and how to own a ticket from investigation through review to production.",
      },
      {
        title: "Debug real production issues",
        body: "Investigating live production problems, often by pairing and peer debugging across the team, taught me to reason about systems I only partly understood and to communicate clearly while doing it.",
      },
    ],
    stack: [
      { group: "Frontend", items: ["Angular"] },
      { group: "Backend", items: ["C# / .NET", "REST APIs"] },
      { group: "Data", items: ["SQL"] },
      { group: "Process", items: ["Agile", "Code Review", "Peer Debugging"] },
    ],
    outcomes: [
      { metric: "30+", label: "production tickets resolved" },
      { metric: "50+", label: "engineer team" },
      { metric: "Full-stack", label: "Angular, .NET, and SQL" },
      { metric: "First time", label: "in a codebase this large" },
    ],
  },
];

export function getCaseStudy(slug: string) {
  return caseStudies.find((c) => c.slug === slug);
}

// Map an experience company name to its case study slug (for linking).
export const caseStudyByCompany: Record<string, string> = {
  "Voyage Foods": "voyage-foods-dashboard",
  "London Computer Systems": "lcs-big-team",
  JAKAPA: "jakapa-canvas-integration",
  "American Equity Funding, Inc.": "aef-access-migration",
};
