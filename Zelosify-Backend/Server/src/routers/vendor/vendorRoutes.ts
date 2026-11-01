import express, { type RequestHandler } from "express";
import vendorRequestRoutes from "./vendorRequestRoutes.js";
import { authenticateUser } from "../../middlewares/auth/authenticateMiddleware.js";
import { authorizeRole } from "../../middlewares/auth/authorizeMiddleware.js";
import { VendorContractHiringController } from "../../controllers/vendor/contractHiringController.js";

const router = express.Router();

/**
 * Legacy vendor request routes
 */
router.use("/requests", vendorRequestRoutes);

/**
 * =============================================================================
 * IT VENDOR PERSONA - CONTRACT OPENINGS & PROFILE SUBMISSION
 * Role: IT_VENDOR
 * =============================================================================
 */

// 1. Fetch Openings (tenant-filtered, paginated)
router.get(
  "/openings",
  authenticateUser as RequestHandler,
  authorizeRole("IT_VENDOR") as RequestHandler,
  VendorContractHiringController.getOpenings as RequestHandler
);

// 2. Fetch Opening Details (opening details, profiles count, vendor's own uploads, NO AI fields)
router.get(
  "/openings/:id",
  authenticateUser as RequestHandler,
  authorizeRole("IT_VENDOR") as RequestHandler,
  VendorContractHiringController.getOpeningDetails as RequestHandler
);

// 3. Presign Upload URLs for S3
router.post(
  "/openings/:id/profiles/presign",
  authenticateUser as RequestHandler,
  authorizeRole("IT_VENDOR") as RequestHandler,
  VendorContractHiringController.presignUpload as RequestHandler
);

// 4. Submit Profiles (uses Prisma transaction & triggers async recommendation)
router.post(
  "/openings/:id/profiles/upload",
  authenticateUser as RequestHandler,
  authorizeRole("IT_VENDOR") as RequestHandler,
  VendorContractHiringController.submitProfiles as RequestHandler
);

// 5. Soft delete candidate profile
router.delete(
  "/profiles/:id",
  authenticateUser as RequestHandler,
  authorizeRole("IT_VENDOR") as RequestHandler,
  VendorContractHiringController.softDeleteProfile as RequestHandler
);

// 6. Preview uploaded profile
router.get(
  "/profiles/:id/preview",
  authenticateUser as RequestHandler,
  authorizeRole("IT_VENDOR") as RequestHandler,
  VendorContractHiringController.previewProfile as RequestHandler
);

export default router;
