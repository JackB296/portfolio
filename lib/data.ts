export const profile = {
  name: "Jackson Bialecki",
  firstName: "Jackson",
  title: "Full Stack Engineer",
  specialties: ["Web", "AI / Machine Learning", "Industrial Systems"],
  status: "Available for co-op — Spring 2027",
  location: "Cincinnati, Ohio",
  tagline:
    "I build production systems where the web meets the real world — full-stack apps, ML experiments, and the SCADA/ERP pipelines that keep factories running.",
  bio: [
    "I'm a Full Stack Engineer and Computer Science student at the University of Cincinnati, working through a 5-year co-op program. I've shipped production software at a manufacturing plant, an enterprise software company, and an ed-tech startup.",
    "My range runs from React/Angular front ends and C#/.NET and Node APIs down to PostgreSQL data layers and Ignition SCADA tag historians. I like problems like integrations, migrations, and dashboards that turn messy real-world data into something people can actually use.",
  ],
  email: "bialecjr@mail.uc.edu",
  github: "https://github.com/JackB296",
  githubHandle: "JackB296",
  linkedin: "https://www.linkedin.com/in/jackson-bialecki/",
  linkedinHandle: "jackson-bialecki",
  resume: "/resume",
  resumePdf: "/Bialecki_Jackson_Resume2026.pdf",
};

export type Experience = {
  role: string;
  company: string;
  location: string;
  period: string;
  points: string[];
  tags: string[];
};

export const experience: Experience[] = [
  {
    role: "Computer Science Engineer Intern",
    company: "Voyage Foods",
    location: "Mason, OH",
    period: "May 2026 — Aug 2026",
    points: [
      "Built and expanded a production manufacturing dashboard integrating Cin7 Core ERP, SafetyChain QA, Ignition SCADA, and PostgreSQL data into one centralized React interface.",
      "Migrated PLC tag storage from SQLite to PostgreSQL and visualized 200+ Ignition tags across 10+ production machines for analysis, graphing, and plant-floor performance monitoring.",
    ],
    tags: ["React", "PostgreSQL", "Ignition SCADA", "Cin7 ERP"],
  },
  {
    role: "Full Stack Developer Co-op",
    company: "London Computer Systems",
    location: "Cincinnati, OH",
    period: "Aug 2025 — Dec 2025",
    points: [
      "Resolved 30+ production tickets involving bug fixes, feature enhancements, and database updates across Angular front ends, C#/.NET APIs, and SQL-backed systems.",
      "Collaborated with a 50+ engineer team through code reviews, sprint planning, peer debugging, and production issue investigation in an Agile environment.",
    ],
    tags: ["Angular", "C# / .NET", "SQL", "Agile"],
  },
  {
    role: "Full Stack Developer",
    company: "JAKAPA",
    location: "Remote",
    period: "May 2023 — Jun 2025",
    points: [
      "Built a full-stack Edlink API integration linking JAKAPA's Angular platform to Canvas LMS, automating single sign-on, first-login account creation, and class enrollment from Canvas rosters.",
      "Engineered Node.js services that mirror Canvas rostering into PostgreSQL on login, with idempotent upserts so re-syncing never duplicates a student.",
    ],
    tags: ["Angular", "Node.js", "Edlink API", "PostgreSQL"],
  },
  {
    role: "Database Administrator",
    company: "American Equity Funding, Inc.",
    location: "Remote",
    period: "Aug 2023 — Oct 2024",
    points: [
      "Managed investor and financial data across multiple databases while maintaining data integrity, security, and reporting accuracy.",
      "Migrated legacy Microsoft Access workflows to PostgreSQL and built Java tools that let non-technical staff safely query and update records.",
    ],
    tags: ["PostgreSQL", "Java", "MS Access", "Data Migration"],
  },
];

export type Project = {
  name: string;
  blurb: string;
  tools: string[];
  github?: string;
  live?: string;
  liveLabel?: string;
  caseStudy?: string;
  accentLabel: string;
  featured?: boolean;
  image?: string;
};

// "Projects" = projects (live demos, hardware, side projects).
// Professional work lives in lib/caseStudies.ts and renders as its own group.
export const projects: Project[] = [
  {
    name: "8-Bit Programmable Computer",
    blurb:
      "A physical 8-bit computer built by hand from simple logic gates on breadboards. Includes an ALU, registers, RAM, a clock, control logic, and a decimal display. It runs assembly programs with add/subtract, load-immediate, store, and jump instructions. My senior-year engineering capstone, inspired by Ben Eater.",
    tools: ["Digital Logic", "EEPROMs", "Assembly", "Breadboards"],
    caseStudy: "8-bit-computer",
    accentLabel: "Hardware · Digital Logic",
    featured: true,
    image: "/8bit-computer.webp",
  },
  {
    name: "Neuroevolution Flappy Bird",
    blurb:
      "An AI-driven Flappy Bird where a population of neural-network birds evolves through neuroevolution, getting better over generations until it clears the pipes on its own. Play it or watch the AI learn right here.",
    tools: ["JavaScript", "p5.js", "Neuroevolution", "Genetic Algorithm"],
    github: "https://github.com/JackB296/neuroevolution-flappy-bird",
    live: "/flappy",
    liveLabel: "Play the live demo",
    accentLabel: "AI / ML",
  },
  {
    name: "Raycasting Engine",
    blurb:
      "A from-scratch pseudo-3D renderer that marches rays through a 2D grid, Wolfenstein-style, and draws the 2D map and its rays beside the rendered 3D view. A JS port of my Python engine, running live in your browser.",
    tools: ["Python", "JavaScript", "Canvas", "Raycasting"],
    github: "https://github.com/JackB296/raycasting-engine",
    live: "/raycaster",
    liveLabel: "Walk through it",
    accentLabel: "Graphics",
  },
  {
    name: "Cloth Simulation",
    blurb:
      "A real-time cloth of point masses linked by sticks, solved with Verlet integration. Drag your mouse across it to slice through the threads. Another JS port of my original Python simulation.",
    tools: ["Python", "JavaScript", "Canvas", "Verlet", "Physics"],
    github: "https://github.com/JackB296/Cloth-Simulation",
    live: "/cloth",
    liveLabel: "Play with it",
    accentLabel: "Physics",
  },
  {
    name: "Conway's Game of Life",
    blurb:
      "The classic cellular automaton with age-colored cells. Four tiny rules give rise to gliders, oscillators, and whole ecosystems. Draw your own cells and watch the patterns breathe. A JS port of my Python version.",
    tools: ["Python", "JavaScript", "Canvas", "Cellular Automata"],
    github: "https://github.com/JackB296/life-sim",
    live: "/game-of-life",
    liveLabel: "Play with it",
    accentLabel: "Simulation",
  },
];

export type SkillGroup = {
  title: string;
  skills: string[];
};

export const skillGroups: SkillGroup[] = [
  {
    title: "Languages",
    skills: ["C#", "Java", "Python", "C", "C++", "SQL", "JavaScript", "HTML/CSS", "MATLAB", "VBA"],
  },
  {
    title: "Frameworks",
    skills: ["React", "Angular", "Node.js", "Flask", ".NET"],
  },
  {
    title: "Databases & Cloud",
    skills: ["PostgreSQL", "Google Cloud SQL", "Cloud Scheduler", "SQLite", "MS Access", "pgAdmin"],
  },
  {
    title: "Industrial Systems",
    skills: ["Ignition SCADA", "Tag Historian", "OPC-UA", "Siemens S7 PLCs", "Cin7 ERP", "SafetyChain"],
  },
  {
    title: "Tools & Concepts",
    skills: ["Git", "REST APIs", "API Integration", "Database Design", "SSL/TLS", "Full-Stack Dev"],
  },
  {
    title: "Professional",
    skills: ["Agile / Scrum", "Code Review", "Cross-Functional Collaboration", "Technical Communication", "Problem Solving", "Adaptability"],
  },
];

export const education = {
  school: "University of Cincinnati",
  degree: "B.S. Computer Science — 5-Year Co-op Program",
  location: "Cincinnati, Ohio",
  period: "Expected May 2029",
  gpa: "3.44 / 4.00",
  coursework: [
    "Data Structures",
    "Intro to Computer Systems",
    "Information Security & Assurance",
    "Discrete Structures",
  ],
};

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "Experience", href: "#experience" },
  { label: "Projects", href: "#projects" },
  { label: "Skills", href: "#skills" },
  { label: "Contact", href: "#contact" },
];
