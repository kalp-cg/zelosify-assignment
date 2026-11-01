import { describe, it, expect, vi } from "vitest";
import { VendorContractHiringController } from "../../src/controllers/vendor/contractHiringController.js";
import { HiringContractController } from "../../src/controllers/hiring/hiringContractController.js";
import prisma from "../../src/config/prisma/prisma.js";

describe("RBAC, Tenant Isolation & Data Leakage Prevention", () => {
  describe("1. IT Vendor Data Isolation & AI Suppression", () => {
    it("ensures IT Vendor cannot view AI recommendation fields in opening details", async () => {
      // Mock opening under Tenant A
      const mockOpening = {
        id: "opening-123",
        tenantId: "tenant-bruce-wayne",
        title: "Frontend Engineer",
        experienceMin: 3,
        experienceMax: 6,
        hiringManagerId: "hm-1",
      };

      // Mock profiles: one by vendor-1, one by vendor-2 (peer vendor)
      const mockVendorProfiles = [
        {
          id: 1,
          openingId: "opening-123",
          s3Key: "tenant-bruce-wayne/opening-123/1000_resume.pdf",
          uploadedBy: "vendor-1",
          status: "SUBMITTED",
          isDeleted: false,
          submittedAt: new Date(),
          // AI fields present in DB:
          recommended: true,
          recommendationScore: 0.95,
          recommendationReason: "Secret AI internal note",
          recommendationConfidence: 0.98,
          recommendationLatencyMs: 120,
        },
      ];

      vi.spyOn(prisma.opening, "findFirst").mockResolvedValue(mockOpening as any);
      vi.spyOn(prisma.hiringProfile, "count").mockResolvedValue(2);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue({ firstName: "Lucius", lastName: "Fox" } as any);
      vi.spyOn(prisma.hiringProfile, "findMany").mockResolvedValue([
        {
          id: 1,
          openingId: "opening-123",
          s3Key: "tenant-bruce-wayne/opening-123/1000_resume.pdf",
          uploadedBy: "vendor-1",
          status: "SUBMITTED",
          isDeleted: false,
          submittedAt: mockVendorProfiles[0].submittedAt,
        } as any,
      ]);

      const req: any = {
        params: { id: "opening-123" },
        user: {
          id: "vendor-1",
          role: "IT_VENDOR",
          tenant: { tenantId: "tenant-bruce-wayne" },
        },
      };

      let responseStatus = 0;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => {
          responseStatus = code;
          return res;
        },
        json: (data: any) => {
          responseBody = data;
          return res;
        },
      };

      await VendorContractHiringController.getOpeningDetails(req, res);

      expect(responseStatus).toBe(200);
      expect(responseBody.success).toBe(true);

      const returnedProfile = responseBody.data.myUploadedProfiles[0];
      expect(returnedProfile).toBeDefined();

      // MANDATORY SECURITY AUDIT: IT Vendor MUST NOT see AI recommendation fields!
      expect(returnedProfile.recommended).toBeUndefined();
      expect(returnedProfile.recommendationScore).toBeUndefined();
      expect(returnedProfile.recommendationReason).toBeUndefined();
      expect(returnedProfile.recommendationConfidence).toBeUndefined();
      expect(returnedProfile.recommendationLatencyMs).toBeUndefined();
    });

    it("blocks vendor from soft-deleting another vendor's profile", async () => {
      vi.spyOn(prisma.hiringProfile, "findUnique").mockResolvedValue({
        id: 99,
        uploadedBy: "vendor-2-other",
        isDeleted: false,
      } as any);

      const req: any = {
        params: { id: "99" },
        user: {
          id: "vendor-1",
          role: "IT_VENDOR",
          tenant: { tenantId: "tenant-bruce-wayne" },
        },
      };

      let responseStatus = 0;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => {
          responseStatus = code;
          return res;
        },
        json: (data: any) => {
          responseBody = data;
          return res;
        },
      };

      await VendorContractHiringController.softDeleteProfile(req, res);

      expect(responseStatus).toBe(403);
      expect(responseBody.message).toContain("Forbidden");
    });
  });

  describe("2. Hiring Manager Isolation & Permissions", () => {
    it("blocks hiring manager from accessing another manager's opening profiles", async () => {
      // Opening belongs to hm-2
      vi.spyOn(prisma.opening, "findFirst").mockResolvedValue({
        id: "opening-456",
        tenantId: "tenant-bruce-wayne",
        hiringManagerId: "hm-2-other",
      } as any);

      const req: any = {
        params: { id: "opening-456" },
        user: {
          id: "hm-1-current",
          role: "HIRING_MANAGER",
          tenant: { tenantId: "tenant-bruce-wayne" },
        },
      };

      let responseStatus = 0;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => {
          responseStatus = code;
          return res;
        },
        json: (data: any) => {
          responseBody = data;
          return res;
        },
      };

      await HiringContractController.getOpeningProfiles(req, res);

      expect(responseStatus).toBe(403);
      expect(responseBody.message).toContain("Forbidden");
    });

    it("blocks hiring manager from shortlisting profiles on another manager's opening", async () => {
      vi.spyOn(prisma.hiringProfile, "findUnique").mockResolvedValue({
        id: 50,
        isDeleted: false,
        opening: {
          id: "opening-999",
          hiringManagerId: "hm-2-other",
          tenantId: "tenant-bruce-wayne",
        },
      } as any);

      const req: any = {
        params: { id: "50" },
        user: {
          id: "hm-1-current",
          role: "HIRING_MANAGER",
          tenant: { tenantId: "tenant-bruce-wayne" },
        },
      };

      let responseStatus = 0;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => {
          responseStatus = code;
          return res;
        },
        json: (data: any) => {
          responseBody = data;
          return res;
        },
      };

      await HiringContractController.shortlistProfile(req, res);

      expect(responseStatus).toBe(403);
      expect(responseBody.message).toContain("Forbidden");
    });
  });
});
