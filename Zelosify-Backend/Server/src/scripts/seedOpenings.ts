import prisma from "../config/prisma/prisma.js";
import { OpeningStatus, Role } from "@prisma/client";

/**
 * Seeds the database with:
 * 1. Tenant: "Bruce Wayne Corp"
 * 2. Hiring Manager: "Lucius Fox" (HIRING_MANAGER)
 * 3. IT Vendor: "Wayne Tech Solutions" (IT_VENDOR)
 * 4. At least 12 distinct contract job openings adhering to tenant isolation
 */
export async function seedOpenings() {
  try {
    console.log("🌱 Starting seed for Bruce Wayne Corp...");

    // 1. Ensure Tenant "Bruce Wayne Corp" exists
    let tenant = await prisma.tenants.findFirst({
      where: { companyName: "Bruce Wayne Corp" },
    });

    if (!tenant) {
      tenant = await prisma.tenants.create({
        data: {
          companyName: "Bruce Wayne Corp",
        },
      });
      console.log(`✅ Created Tenant: Bruce Wayne Corp (${tenant.tenantId})`);
    } else {
      console.log(`ℹ️ Existing Tenant found: Bruce Wayne Corp (${tenant.tenantId})`);
    }

    const tenantId = tenant.tenantId;

    // 2. Ensure a default Hiring Manager user exists under this tenant
    let hiringManager = await prisma.user.findFirst({
      where: {
        tenantId,
        role: Role.HIRING_MANAGER,
      },
    });

    if (!hiringManager) {
      hiringManager = await prisma.user.create({
        data: {
          username: "lucius.fox",
          email: "lucius.fox@waynecorp.com",
          firstName: "Lucius",
          lastName: "Fox",
          phoneNumber: "+15550192834",
          department: "Applied Sciences",
          role: Role.HIRING_MANAGER,
          tenantId,
          profileComplete: true,
        },
      });
      console.log(`✅ Created Hiring Manager: Lucius Fox (${hiringManager.id})`);
    } else {
      console.log(`ℹ️ Existing Hiring Manager found: ${hiringManager.firstName} ${hiringManager.lastName} (${hiringManager.id})`);
    }

    const hiringManagerId = hiringManager.id;

    // 3. 14 distinct contract openings with various roles, locations, contract types, experience bounds
    const sampleOpenings = [
      {
        title: "Senior Full Stack TypeScript Engineer",
        description: "Looking for an expert contractor proficient in React, Next.js, Node.js, and PostgreSQL for enterprise portal modernization.",
        location: "Remote",
        contractType: "C2C (12 Months)",
        experienceMin: 5,
        experienceMax: 9,
        status: OpeningStatus.OPEN,
      },
      {
        title: "AI / ML Agent Systems Architect",
        description: "Design and implement autonomous LLM agents with function-calling, vector storage, and Python pipelines.",
        location: "New York, NY",
        contractType: "Full-Time Contract",
        experienceMin: 4,
        experienceMax: 8,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Cloud Infrastructure & DevOps Engineer",
        description: "Seeking AWS and Kubernetes specialist to lead infrastructure migration, Docker containers, and CI/CD pipelines.",
        location: "Remote",
        contractType: "C2C (6 Months)",
        experienceMin: 5,
        experienceMax: 10,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Senior Backend Node.js Engineer",
        description: "High-throughput API microservices development with Express, Redis, PostgreSQL, and Prisma ORM.",
        location: "San Francisco, CA",
        contractType: "Full-Time Contract",
        experienceMin: 4,
        experienceMax: 7,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Frontend UI/UX React Specialist",
        description: "Build accessible, performant design systems and dashboards with React 19, Tailwind CSS, and Radix UI.",
        location: "Remote",
        contractType: "Part-Time Contract",
        experienceMin: 3,
        experienceMax: 6,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Lead Cybersecurity & IAM Engineer",
        description: "Architect Zero-Trust security, Keycloak SSO, RS256 token verification, and SOC2 compliance controls.",
        location: "Chicago, IL",
        contractType: "C2C (12 Months)",
        experienceMin: 7,
        experienceMax: 12,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Data Platform & ETL Specialist",
        description: "Build robust streaming pipelines using Python, PostgreSQL, and AWS S3 analytics.",
        location: "Remote",
        contractType: "Full-Time Contract",
        experienceMin: 3,
        experienceMax: 7,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Distributed Systems Golang Engineer",
        description: "Construct scalable microservices in Go with gRPC, Docker, and Kubernetes deployment.",
        location: "Austin, TX",
        contractType: "C2C (9 Months)",
        experienceMin: 5,
        experienceMax: 10,
        status: OpeningStatus.OPEN,
      },
      {
        title: "QA Automation & Test Architect",
        description: "Lead end-to-end integration and load testing with Vitest, Playwright, and automated performance suites.",
        location: "Remote",
        contractType: "Full-Time Contract",
        experienceMin: 3,
        experienceMax: 6,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Senior Database Administrator (PostgreSQL)",
        description: "Optimize complex schema migrations, connection pooling, and multi-tenant isolation policies.",
        location: "New York, NY",
        contractType: "Part-Time Contract",
        experienceMin: 6,
        experienceMax: 12,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Mobile React Native Engineer",
        description: "Deliver cross-platform iOS and Android applications with offline sync and biometric authentication.",
        location: "Remote",
        contractType: "Full-Time Contract",
        experienceMin: 3,
        experienceMax: 5,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Site Reliability Engineer (SRE)",
        description: "Maintain 99.99% uptime, alerting, structured JSON logging, and disaster recovery architectures.",
        location: "Seattle, WA",
        contractType: "C2C (6 Months)",
        experienceMin: 4,
        experienceMax: 8,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Technical Product & Scrum Lead",
        description: "Oversee contractual delivery milestones, sprint tracking, and SLA enforcement across vendor contracts.",
        location: "Remote",
        contractType: "Full-Time Contract",
        experienceMin: 5,
        experienceMax: null,
        status: OpeningStatus.OPEN,
      },
      {
        title: "Junior Cloud Operations Associate",
        description: "Entry-level cloud support with AWS monitoring, incident response, and documentation.",
        location: "Boston, MA",
        contractType: "Part-Time Contract",
        experienceMin: 1,
        experienceMax: 3,
        status: OpeningStatus.OPEN,
      },
    ];

    let createdCount = 0;
    for (const op of sampleOpenings) {
      const existing = await prisma.opening.findFirst({
        where: {
          tenantId,
          title: op.title,
        },
      });

      if (!existing) {
        await prisma.opening.create({
          data: {
            tenantId,
            hiringManagerId,
            title: op.title,
            description: op.description,
            location: op.location,
            contractType: op.contractType,
            experienceMin: op.experienceMin,
            experienceMax: op.experienceMax,
            status: op.status,
            postedDate: new Date(Date.now() - Math.floor(Math.random() * 14 * 86400000)),
          },
        });
        createdCount++;
      }
    }

    console.log(`✅ Seed finished! Added ${createdCount} new openings under Tenant "${tenant.companyName}".`);
  } catch (error) {
    console.error("❌ Error seeding openings:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.includes("seedOpenings")) {
  seedOpenings()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
