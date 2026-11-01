import { describe, it, expect } from "vitest";
import { AgentOrchestrator } from "../../src/services/aiAgent/orchestrator/agentOrchestrator.js";

describe("Strict Performance & Latency SLA (P95 < 2000ms)", () => {
  it("simulates 100 profile evaluations and verifies P95 latency is strictly under 2000ms", async () => {
    const jobRequirements = {
      title: "Full Stack Engineer",
      location: "Remote",
      experienceMin: 3,
      experienceMax: 7,
      contractType: "C2C",
      requiredSkills: ["React", "Node.js", "TypeScript", "PostgreSQL"],
    };

    const simulatedCandidateTexts = [
      "Experienced Full Stack React and Node.js developer with 5 years in TypeScript, PostgreSQL, and AWS.",
      "Junior frontend enthusiast with 2 years in React, HTML, CSS, JavaScript based in New York.",
      "Lead architect with 10 years experience in Go, Kubernetes, Docker, and distributed microservices.",
      "Backend specialist with 4 years in Node.js, Express, Redis, and PostgreSQL.",
      "Python data engineer with 6 years experience in ETL, SQL, and machine learning pipelines.",
    ];

    const latencies: number[] = [];
    const TOTAL_PROFILES = 100;

    console.log(`⏱️ Starting benchmark of ${TOTAL_PROFILES} candidate profiles...`);

    for (let i = 0; i < TOTAL_PROFILES; i++) {
      const sampleText = simulatedCandidateTexts[i % simulatedCandidateTexts.length];
      const start = Date.now();

      const { result, reasoningState } = await AgentOrchestrator.evaluateCandidate({
        profileId: i + 1,
        openingId: `opening-perf-${(i % 5) + 1}`,
        s3Key: `tenant-perf/opening-${i + 1}/${Date.now()}_resume_${i}.pdf`,
        jobRequirements,
        rawContent: sampleText,
      });

      const latencyMs = Date.now() - start;
      latencies.push(latencyMs);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(reasoningState.steps.length).toBeGreaterThanOrEqual(1);
    }

    // Sort latencies ascending to compute percentiles
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(TOTAL_PROFILES * 0.5)];
    const p90 = latencies[Math.floor(TOTAL_PROFILES * 0.9)];
    const p95 = latencies[Math.floor(TOTAL_PROFILES * 0.95)];
    const max = latencies[latencies.length - 1];
    const avg = Math.round(latencies.reduce((sum, val) => sum + val, 0) / TOTAL_PROFILES);

    console.log(`📊 Benchmark Results for ${TOTAL_PROFILES} Profiles:`, {
      avgLatencyMs: avg,
      p50LatencyMs: p50,
      p90LatencyMs: p90,
      p95LatencyMs: p95,
      maxLatencyMs: max,
      slaLimitMs: 2000,
    });

    // Mandatory SLA check: P95 latency must be < 2000ms
    expect(p95).toBeLessThan(2000);
  }, 60000); // 60s test timeout
});
