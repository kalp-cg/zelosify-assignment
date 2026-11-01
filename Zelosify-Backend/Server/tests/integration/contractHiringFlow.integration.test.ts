import { describe, it, expect, vi } from "vitest";
import { VendorContractHiringController } from "../../src/controllers/vendor/contractHiringController.js";
import { HiringContractController } from "../../src/controllers/hiring/hiringContractController.js";
import { AgentOrchestrator } from "../../src/services/aiAgent/orchestrator/agentOrchestrator.js";
import prisma from "../../src/config/prisma/prisma.js";

describe("End-to-End Integration Flow: Upload -> Submit -> Recommend -> Shortlist", () => {
  it("executes the entire multi-persona lifecycle smoothly", async () => {
    const tenantId = "tenant-bruce-wayne";
    const vendorUserId = "vendor-bruce-tech";
    const managerUserId = "hm-lucius-fox";
    const openingId = "opening-uuid-101";

    const mockOpening = {
      id: openingId,
      tenantId,
      title: "Senior Fullstack Engineer",
      location: "Remote",
      experienceMin: 4,
      experienceMax: 8,
      status: "OPEN",
      hiringManagerId: managerUserId,
      postedDate: new Date(),
    };

    // 1. Presign Upload URL by IT_VENDOR
    const presignReq: any = {
      params: { id: openingId },
      body: { fileName: "candidate_resume.pdf" },
      user: { id: vendorUserId, role: "IT_VENDOR", tenant: { tenantId } },
    };

    vi.spyOn(prisma.opening, "findFirst").mockResolvedValue(mockOpening as any);

    let presignStatus = 0;
    let presignBody: any = null;
    const presignRes: any = {
      status: (c: number) => { presignStatus = c; return presignRes; },
      json: (d: any) => { presignBody = d; return presignRes; },
    };

    await VendorContractHiringController.presignUpload(presignReq, presignRes);
    expect(presignStatus).toBe(200);
    expect(presignBody.data.s3Key).toContain(tenantId);
    expect(presignBody.data.s3Key).toContain(openingId);
    expect(presignBody.data.uploadUrl).toBeDefined();

    const generatedS3Key = presignBody.data.s3Key;

    // 2. Submit Profile by IT_VENDOR via Prisma Transaction
    const mockCreatedProfile = {
      id: 888,
      openingId,
      s3Key: generatedS3Key,
      uploadedBy: vendorUserId,
      submittedAt: new Date(),
      status: "SUBMITTED",
      isDeleted: false,
    };

    vi.spyOn(prisma, "$transaction").mockImplementation(async (cb: any) => {
      const tx = {
        hiringProfile: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(mockCreatedProfile),
          update: vi.fn().mockResolvedValue({ ...mockCreatedProfile, status: "SHORTLISTED" }),
        },
      };
      return await cb(tx);
    });

    const submitReq: any = {
      params: { id: openingId },
      body: { s3Key: generatedS3Key, rawContent: "Candidate with 5 years experience in React, Node.js, and TypeScript." },
      user: { id: vendorUserId, role: "IT_VENDOR", tenant: { tenantId } },
    };

    let submitStatus = 0;
    let submitBody: any = null;
    const submitRes: any = {
      status: (c: number) => { submitStatus = c; return submitRes; },
      json: (d: any) => { submitBody = d; return submitRes; },
    };

    await VendorContractHiringController.submitProfiles(submitReq, submitRes);
    expect(submitStatus).toBe(201);
    expect(submitBody.data.id).toBe(888);
    expect(submitBody.data.status).toBe("SUBMITTED");

    // 3. AI Agent Recommendation Evaluation
    const { result, reasoningState } = await AgentOrchestrator.evaluateCandidate({
      profileId: 888,
      openingId,
      s3Key: generatedS3Key,
      jobRequirements: {
        title: mockOpening.title,
        location: mockOpening.location,
        experienceMin: mockOpening.experienceMin,
        experienceMax: mockOpening.experienceMax,
        requiredSkills: ["React", "Node.js", "TypeScript"],
      },
      rawContent: "Candidate with 5 years experience in React, Node.js, and TypeScript.",
    });

    expect(result.recommended).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.75);
    expect(result.reason).toBeDefined();
    expect(reasoningState.tokenUsage.totalTokens).toBeGreaterThan(0);

    // 4. Hiring Manager views opening profiles and sees AI score & badge
    vi.spyOn(prisma.hiringProfile, "findMany").mockResolvedValue([
      {
        ...mockCreatedProfile,
        recommended: result.recommended,
        recommendationScore: result.score,
        recommendationConfidence: result.confidence,
        recommendationReason: result.reason,
        recommendationLatencyMs: reasoningState.totalLatencyMs || 2,
      } as any,
    ]);

    const viewProfilesReq: any = {
      params: { id: openingId },
      user: { id: managerUserId, role: "HIRING_MANAGER", tenant: { tenantId } },
    };

    let viewStatus = 0;
    let viewBody: any = null;
    const viewRes: any = {
      status: (c: number) => { viewStatus = c; return viewRes; },
      json: (d: any) => { viewBody = d; return viewRes; },
    };

    await HiringContractController.getOpeningProfiles(viewProfilesReq, viewRes);
    expect(viewStatus).toBe(200);
    expect(viewBody.data.profiles.length).toBe(1);
    expect(viewBody.data.profiles[0].recommendationBadge).toBe("Recommended");
    expect(viewBody.data.profiles[0].score).toBeGreaterThanOrEqual(75);

    // 5. Hiring Manager shortlists candidate profile
    vi.spyOn(prisma.hiringProfile, "findUnique").mockResolvedValue({
      ...mockCreatedProfile,
      opening: mockOpening,
    } as any);

    const shortlistReq: any = {
      params: { id: "888" },
      user: { id: managerUserId, role: "HIRING_MANAGER", tenant: { tenantId } },
    };

    let shortlistStatus = 0;
    let shortlistBody: any = null;
    const shortlistRes: any = {
      status: (c: number) => { shortlistStatus = c; return shortlistRes; },
      json: (d: any) => { shortlistBody = d; return shortlistRes; },
    };

    await HiringContractController.shortlistProfile(shortlistReq, shortlistRes);
    expect(shortlistStatus).toBe(200);
    expect(shortlistBody.message).toContain("shortlisted successfully");
  });
});
