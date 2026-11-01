import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types/typeIndex.js";
import prisma from "../../config/prisma/prisma.js";
import { createStorageService } from "../../services/storage/storageFactory.js";
import { RecommendationService } from "../../services/aiAgent/recommendationService.js";

export class VendorContractHiringController {
  /**
   * GET /api/vendor/openings
   * Paginated openings list, strictly filtered by user's tenantId.
   */
  public static async getOpenings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tenantId = req.user?.tenant?.tenantId;
      if (!tenantId) {
        res.status(400).json({ message: "User tenant context is missing." });
        return;
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
      const skip = (page - 1) * limit;

      const statusFilter = req.query.status as string;
      const search = (req.query.search as string || "").trim();

      const whereClause: any = {
        tenantId,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
                { contractType: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [total, openings] = await Promise.all([
        prisma.opening.count({ where: whereClause }),
        prisma.opening.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { postedDate: "desc" },
        }),
      ]);

      // Collect hiring manager names
      const managerIds = Array.from(new Set(openings.map((o) => o.hiringManagerId).filter(Boolean)));
      const managers = await prisma.user.findMany({
        where: { id: { in: managerIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      const managerMap = new Map(managers.map((m) => [m.id, `${m.firstName || ""} ${m.lastName || ""}`.trim() || "Hiring Manager"]));

      const results = openings.map((op) => ({
        ...op,
        hiringManagerName: managerMap.get(op.hiringManagerId) || "Hiring Manager",
      }));

      res.status(200).json({
        success: true,
        data: results,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error("[VendorContractHiringController.getOpenings] Error:", error);
      res.status(500).json({ message: "Failed to fetch openings.", error: error.message });
    }
  }

  /**
   * GET /api/vendor/openings/:id
   * Must include: Hiring Manager name, experience range, profiles count, uploaded profiles list
   * Strictly isolated: Only profiles uploaded by this vendor, NO AI recommendation fields leaked!
   */
  public static async getOpeningDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant?.tenantId;
      const vendorUserId = req.user?.id;

      if (!tenantId || !vendorUserId) {
        res.status(401).json({ message: "Unauthorized or missing tenant context." });
        return;
      }

      const opening = await prisma.opening.findFirst({
        where: { id, tenantId },
      });

      if (!opening) {
        res.status(404).json({ message: "Opening not found or inaccessible under this tenant." });
        return;
      }

      // Fetch hiring manager details
      let hiringManagerName = "Hiring Manager";
      if (opening.hiringManagerId) {
        const hm = await prisma.user.findUnique({
          where: { id: opening.hiringManagerId },
          select: { firstName: true, lastName: true },
        });
        if (hm) {
          hiringManagerName = `${hm.firstName || ""} ${hm.lastName || ""}`.trim() || hiringManagerName;
        }
      }

      // Profiles count across this opening
      const totalProfilesCount = await prisma.hiringProfile.count({
        where: { openingId: id, isDeleted: false },
      });

      // Vendor uploaded profiles: ONLY profiles where uploadedBy === vendorUserId AND isDeleted === false
      // Explicitly EXCLUDE AI recommendation fields per strict RBAC requirements
      const myProfiles = await prisma.hiringProfile.findMany({
        where: {
          openingId: id,
          uploadedBy: vendorUserId,
          isDeleted: false,
        },
        select: {
          id: true,
          openingId: true,
          s3Key: true,
          submittedAt: true,
          status: true,
          isDeleted: true,
          // CRITICAL: Do NOT select recommendation fields (recommended, score, reason, confidence, latency)
        },
        orderBy: { submittedAt: "desc" },
      });

      // Format clean file names
      const formattedProfiles = myProfiles.map((p) => {
        const parts = p.s3Key.split("/");
        const rawFileName = parts[parts.length - 1] || p.s3Key;
        const cleanName = rawFileName.replace(/^\d+_/, "");
        return {
          ...p,
          fileName: cleanName,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          ...opening,
          hiringManagerName,
          experienceRange: {
            min: opening.experienceMin,
            max: opening.experienceMax,
          },
          profilesCount: totalProfilesCount,
          myUploadedProfiles: formattedProfiles,
        },
      });
    } catch (error: any) {
      console.error("[VendorContractHiringController.getOpeningDetails] Error:", error);
      res.status(500).json({ message: "Failed to fetch opening details.", error: error.message });
    }
  }

  /**
   * POST /api/vendor/openings/:id/profiles/presign
   * Generate secure presigned URL for direct S3 upload
   * Path: <tenantId>/<openingId>/<timestamp>_<filename>
   */
  public static async presignUpload(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { fileName } = req.body;
      const tenantId = req.user?.tenant?.tenantId;

      if (!tenantId) {
        res.status(400).json({ message: "Tenant context required." });
        return;
      }

      if (!fileName || typeof fileName !== "string") {
        res.status(400).json({ message: "Valid fileName is required." });
        return;
      }

      // Check file extension: must be PDF or PPTX
      const lowerName = fileName.toLowerCase();
      if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".pptx")) {
        res.status(400).json({ message: "Invalid file format. Only PDF and PPTX are permitted." });
        return;
      }

      // Verify opening exists under tenant
      const opening = await prisma.opening.findFirst({
        where: { id, tenantId },
      });

      if (!opening) {
        res.status(404).json({ message: "Opening not found." });
        return;
      }

      const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const timestamp = Date.now();
      const s3Key = `${tenantId}/${id}/${timestamp}_${cleanFileName}`;

      const storageService = createStorageService();
      const uploadUrl = await storageService.getUploadURL(s3Key);

      res.status(200).json({
        success: true,
        data: {
          s3Key,
          uploadUrl,
          fileName: cleanFileName,
          expiresIn: 3600,
        },
      });
    } catch (error: any) {
      console.error("[VendorContractHiringController.presignUpload] Error:", error);
      res.status(500).json({ message: "Failed to generate presigned upload URL.", error: error.message });
    }
  }

  /**
   * POST /api/vendor/openings/:id/profiles/upload
   * Must use Prisma transaction.
   * Records candidate profile submission and triggers async AI recommendation.
   */
  public static async submitProfiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { s3Key, rawContent } = req.body;
      const tenantId = req.user?.tenant?.tenantId;
      const vendorUserId = req.user?.id;

      if (!tenantId || !vendorUserId) {
        res.status(401).json({ message: "Unauthorized or missing tenant context." });
        return;
      }

      if (!s3Key || typeof s3Key !== "string") {
        res.status(400).json({ message: "s3Key is required." });
        return;
      }

      // Verify opening exists and is OPEN
      const opening = await prisma.opening.findFirst({
        where: { id, tenantId },
      });

      if (!opening) {
        res.status(404).json({ message: "Opening not found under this tenant." });
        return;
      }

      if (opening.status !== "OPEN") {
        res.status(400).json({ message: `Cannot submit profile: opening is currently ${opening.status}.` });
        return;
      }

      // Mandatory Prisma transaction
      const newProfile = await prisma.$transaction(async (tx) => {
        // Prevent duplicate s3Key submissions
        const existing = await tx.hiringProfile.findUnique({
          where: { s3Key },
        });

        if (existing) {
          throw new Error("Profile with this S3 key has already been submitted.");
        }

        return await tx.hiringProfile.create({
          data: {
            openingId: id,
            s3Key,
            uploadedBy: vendorUserId,
            status: "SUBMITTED",
          },
        });
      });

      // Trigger automatic AI agent evaluation asynchronously (non-blocking)
      RecommendationService.triggerAsyncRecommendation(newProfile.id, { rawContent });

      res.status(201).json({
        success: true,
        message: "Profile submitted successfully. AI evaluation triggered in background.",
        data: {
          id: newProfile.id,
          openingId: newProfile.openingId,
          s3Key: newProfile.s3Key,
          submittedAt: newProfile.submittedAt,
          status: newProfile.status,
        },
      });
    } catch (error: any) {
      console.error("[VendorContractHiringController.submitProfiles] Error:", error);
      res.status(400).json({ message: error.message || "Failed to submit profile." });
    }
  }

  /**
   * DELETE /api/vendor/profiles/:id
   * Soft delete support: marks isDeleted = true if uploaded by this vendor
   */
  public static async softDeleteProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const profileId = parseInt(req.params.id);
      const vendorUserId = req.user?.id;

      if (!profileId || isNaN(profileId)) {
        res.status(400).json({ message: "Valid profile ID required." });
        return;
      }

      const profile = await prisma.hiringProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        res.status(404).json({ message: "Profile not found." });
        return;
      }

      if (profile.uploadedBy !== vendorUserId) {
        res.status(403).json({ message: "Forbidden: You can only delete your own submitted profiles." });
        return;
      }

      await prisma.hiringProfile.update({
        where: { id: profileId },
        data: { isDeleted: true },
      });

      res.status(200).json({
        success: true,
        message: "Profile soft deleted successfully.",
      });
    } catch (error: any) {
      console.error("[VendorContractHiringController.softDeleteProfile] Error:", error);
      res.status(500).json({ message: "Failed to delete profile.", error: error.message });
    }
  }

  /**
   * GET /api/vendor/profiles/:id/preview
   * Generate secure preview URL for vendor's own upload
   */
  public static async previewProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const profileId = parseInt(req.params.id);
      const vendorUserId = req.user?.id;

      const profile = await prisma.hiringProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile || profile.isDeleted) {
        res.status(404).json({ message: "Profile not found." });
        return;
      }

      if (profile.uploadedBy !== vendorUserId) {
        res.status(403).json({ message: "Forbidden: Access denied to other vendor uploads." });
        return;
      }

      const storageService = createStorageService();
      const previewUrl = await storageService.getObjectURL(profile.s3Key);

      res.status(200).json({
        success: true,
        data: {
          previewUrl,
          s3Key: profile.s3Key,
        },
      });
    } catch (error: any) {
      console.error("[VendorContractHiringController.previewProfile] Error:", error);
      res.status(500).json({ message: "Failed to generate preview URL.", error: error.message });
    }
  }
}
