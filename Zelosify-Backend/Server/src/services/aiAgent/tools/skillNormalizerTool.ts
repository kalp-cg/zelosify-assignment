/**
 * Skill Normalization Tool
 * Maps synonyms, abbreviations, and casing variations to canonical standard names.
 */

const SKILL_CANONICAL_MAP: Record<string, string> = {
  // Frontend
  react: "React",
  "react.js": "React",
  reactjs: "React",
  vue: "Vue.js",
  "vue.js": "Vue.js",
  vuejs: "Vue.js",
  angular: "Angular",
  angularjs: "Angular",
  next: "Next.js",
  "next.js": "Next.js",
  nextjs: "Next.js",
  nuxt: "Nuxt.js",
  "nuxt.js": "Nuxt.js",
  svelte: "Svelte",
  html: "HTML5",
  html5: "HTML5",
  css: "CSS3",
  css3: "CSS3",
  tailwind: "Tailwind CSS",
  tailwindcss: "Tailwind CSS",
  bootstrap: "Bootstrap",
  redux: "Redux",

  // Languages & Core Runtimes
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  node: "Node.js",
  "node.js": "Node.js",
  nodejs: "Node.js",
  py: "Python",
  python: "Python",
  python3: "Python",
  java: "Java",
  golang: "Go",
  go: "Go",
  rust: "Rust",
  csharp: "C#",
  "c#": "C#",
  cpp: "C++",
  "c++": "C++",

  // Backend Frameworks
  express: "Express.js",
  "express.js": "Express.js",
  nest: "NestJS",
  nestjs: "NestJS",
  django: "Django",
  fastapi: "FastAPI",
  flask: "Flask",
  spring: "Spring Boot",
  "spring boot": "Spring Boot",
  springboot: "Spring Boot",
  graphql: "GraphQL",
  gql: "GraphQL",
  rest: "REST API",
  "rest api": "REST API",
  restful: "REST API",

  // Databases & ORMs
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  psql: "PostgreSQL",
  mysql: "MySQL",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  redis: "Redis",
  prisma: "Prisma",
  typeorm: "TypeORM",
  sequelize: "Sequelize",

  // Cloud & DevOps
  aws: "AWS",
  "amazon web services": "AWS",
  azure: "Azure",
  gcp: "Google Cloud",
  "google cloud": "Google Cloud",
  docker: "Docker",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  terraform: "Terraform",
  ci: "CI/CD",
  "ci/cd": "CI/CD",
  cicd: "CI/CD",
  git: "Git",
  github: "GitHub",
};

export class SkillNormalizerTool {
  public static normalize(skills: string[]): string[] {
    if (!Array.isArray(skills)) return [];

    const normalizedSet = new Set<string>();

    for (const raw of skills) {
      if (!raw || typeof raw !== "string") continue;
      const clean = raw.trim().toLowerCase();
      if (!clean) continue;

      const canonical = SKILL_CANONICAL_MAP[clean] || (raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1));
      normalizedSet.add(canonical);
    }

    return Array.from(normalizedSet);
  }

  public static getCanonical(skill: string): string {
    const clean = skill.trim().toLowerCase();
    return SKILL_CANONICAL_MAP[clean] || (skill.trim().charAt(0).toUpperCase() + skill.trim().slice(1));
  }
}
