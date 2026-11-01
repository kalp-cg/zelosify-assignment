import Ajv from "ajv";
import type {
  ParsedResume,
  CandidateFeatures,
  DeterministicMatchResult,
  AgentRecommendationOutput,
} from "../types.js";

const ajv = new Ajv({ allErrors: true, coerceTypes: true });

export const parsedResumeSchema = {
  type: "object",
  required: [
    "experienceYears",
    "skills",
    "normalizedSkills",
    "location",
    "education",
    "keywords",
  ],
  properties: {
    experienceYears: { type: "number", minimum: 0 },
    skills: { type: "array", items: { type: "string" } },
    normalizedSkills: { type: "array", items: { type: "string" } },
    location: { type: "string" },
    education: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    rawTextPreview: { type: "string" },
  },
  additionalProperties: true,
};

export const featureVectorSchema = {
  type: "object",
  required: ["experienceYears", "skills", "location"],
  properties: {
    experienceYears: { type: "number", minimum: 0 },
    skills: { type: "array", items: { type: "string" } },
    location: { type: "string" },
  },
  additionalProperties: true,
};

export const scoringResultSchema = {
  type: "object",
  required: [
    "skillMatchScore",
    "experienceMatchScore",
    "locationMatchScore",
    "finalScore",
  ],
  properties: {
    skillMatchScore: { type: "number", minimum: 0, maximum: 1 },
    experienceMatchScore: { type: "number", minimum: 0, maximum: 1 },
    locationMatchScore: { type: "number", minimum: 0, maximum: 1 },
    finalScore: { type: "number", minimum: 0, maximum: 1 },
  },
  additionalProperties: true,
};

export const agentRecommendationSchema = {
  type: "object",
  required: ["recommended", "score", "confidence", "reason"],
  properties: {
    recommended: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string", minLength: 5 },
  },
  additionalProperties: false,
};

const validateParsedResumeFn = ajv.compile(parsedResumeSchema);
const validateFeatureVectorFn = ajv.compile(featureVectorSchema);
const validateScoringResultFn = ajv.compile(scoringResultSchema);
const validateAgentRecommendationFn = ajv.compile(agentRecommendationSchema);

export class SchemaValidator {
  public static validateParsedResume(data: any): {
    valid: boolean;
    errors?: string[];
    data?: ParsedResume;
  } {
    const valid = validateParsedResumeFn(data);
    if (!valid) {
      return {
        valid: false,
        errors: validateParsedResumeFn.errors?.map((e) => `${e.instancePath} ${e.message}`),
      };
    }
    return { valid: true, data: data as unknown as ParsedResume };
  }

  public static validateFeatureVector(data: any): {
    valid: boolean;
    errors?: string[];
    data?: CandidateFeatures;
  } {
    const valid = validateFeatureVectorFn(data);
    if (!valid) {
      return {
        valid: false,
        errors: validateFeatureVectorFn.errors?.map((e) => `${e.instancePath} ${e.message}`),
      };
    }
    return { valid: true, data: data as unknown as CandidateFeatures };
  }

  public static validateScoringResult(data: any): {
    valid: boolean;
    errors?: string[];
    data?: DeterministicMatchResult;
  } {
    const valid = validateScoringResultFn(data);
    if (!valid) {
      return {
        valid: false,
        errors: validateScoringResultFn.errors?.map((e) => `${e.instancePath} ${e.message}`),
      };
    }
    return { valid: true, data: data as unknown as DeterministicMatchResult };
  }

  public static validateAgentRecommendation(data: any): {
    valid: boolean;
    errors?: string[];
    data?: AgentRecommendationOutput;
  } {
    const valid = validateAgentRecommendationFn(data);
    if (!valid) {
      return {
        valid: false,
        errors: validateAgentRecommendationFn.errors?.map(
          (e) => `${e.instancePath} ${e.message}`
        ),
      };
    }
    return { valid: true, data: data as unknown as AgentRecommendationOutput };
  }
}
