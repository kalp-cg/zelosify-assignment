import { SchemaValidator } from "../validator/schemaValidator.js";
import type { CandidateFeatures, ParsedResume } from "../types.js";

export class FeatureExtractorTool {
  public static extract(parsedResume: ParsedResume): CandidateFeatures {
    const featureVector: CandidateFeatures = {
      experienceYears: Number(parsedResume.experienceYears) || 0,
      skills: Array.isArray(parsedResume.normalizedSkills) && parsedResume.normalizedSkills.length > 0
        ? parsedResume.normalizedSkills
        : (parsedResume.skills || []),
      location: (parsedResume.location || "Remote").trim(),
    };

    const validation = SchemaValidator.validateFeatureVector(featureVector);
    if (!validation.valid) {
      throw new Error(`Feature vector validation failed: ${validation.errors?.join(", ")}`);
    }

    return validation.data!;
  }
}
