import prisma from "../../config/prisma/prisma.js";
import { AgentOrchestrator } from "./orchestrator/agentOrchestrator.js";
import type { JobRequirements, AgentRecommendationOutput } from "./types.js";

export class RecommendationService {
  private static readonly AGENT_VERSION = "v1.0.0";

  /**
   * Process a profile by running the AI agent orchestrator and persisting results atomically
   */
  public static async processProfile(
    profileId: number,
    options?: { rawContent?: string; timeoutMs?: number }
  ): Promise<AgentRecommendationOutput> {
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      include: {
        opening: true,
      },
    });

    if (!profile) {
      throw new Error(`Profile with ID ${profileId} not found`);
    }

    const { opening } = profile;
    if (!opening) {
      throw new Error(`Associated opening not found for profile ${profileId}`);
    }

    // Parse required skills from opening description or title
    const requiredSkills: string[] = [];
    const skillKeywords = [
      "React", "Node.js", "TypeScript", "JavaScript", "Python", "Java",
      "Go", "PostgreSQL", "MongoDB", "AWS", "Docker", "Kubernetes", "GraphQL", "Next.js"
    ];
    const combinedDesc = `${opening.title} ${opening.description || ""}`.toLowerCase();
    for (const kw of skillKeywords) {
      if (combinedDesc.includes(kw.toLowerCase())) {
        requiredSkills.push(kw);
      }
    }
    if (requiredSkills.length === 0) {
      requiredSkills.push("TypeScript", "Node.js", "React");
    }

    const jobReq: JobRequirements = {
      title: opening.title,
      location: opening.location || "Remote",
      experienceMin: opening.experienceMin,
      experienceMax: opening.experienceMax,
      contractType: opening.contractType,
      requiredSkills,
    };

    // Run AI Agent
    const { result, reasoningState } = await AgentOrchestrator.evaluateCandidate({
      profileId: profile.id,
      openingId: opening.id,
      s3Key: profile.s3Key,
      jobRequirements: jobReq,
      rawContent: options?.rawContent,
    });

    const latencyMs = reasoningState.totalLatencyMs || 50;

    // Persist result in an ACID Prisma transaction
    await prisma.$transaction(async (tx) => {
      await tx.hiringProfile.update({
        where: { id: profile.id },
        data: {
          recommended: result.recommended,
          recommendationScore: result.score,
          recommendationConfidence: result.confidence,
          recommendationReason: result.reason,
          recommendationLatencyMs: latencyMs,
          recommendationVersion: this.AGENT_VERSION,
          recommendedAt: new Date(),
        },
      });
    });

    return result;
  }

  /**
   * Triggers asynchronous background execution so HTTP APIs do not block >2s
   */
  public static triggerAsyncRecommendation(profileId: number, options?: { rawContent?: string }): void {
    setImmediate(async () => {
      try {
        await this.processProfile(profileId, options);
      } catch (err: any) {
        console.error(`[RecommendationService] Background evaluation failed for profile ${profileId}:`, err);
      }
    });
  }
}
