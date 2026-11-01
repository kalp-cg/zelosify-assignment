import { ResumeParserTool } from "./resumeParserTool.js";
import { FeatureExtractorTool } from "./featureExtractorTool.js";
import { SkillNormalizerTool } from "./skillNormalizerTool.js";
import { DeterministicMatchingTool } from "./deterministicMatchingTool.js";
import { ScoringEngineTool } from "./scoringEngineTool.js";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

export class ToolRegistry {
  public static getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: "parseResume",
        description: "Parse and sanitize candidate resume text or file to extract structured fields (experience, skills, education, location).",
        parameters: {
          type: "object",
          properties: {
            s3Key: { type: "string", description: "S3 file key of the uploaded resume" },
            rawContent: { type: "string", description: "Direct text content if available" },
          },
          required: [],
        },
      },
      {
        name: "extractFeatures",
        description: "Extract candidate feature vector (experienceYears, skills, location) from parsed resume data.",
        parameters: {
          type: "object",
          properties: {
            parsedResume: {
              type: "object",
              description: "Structured parsed resume object containing experienceYears, skills, location",
            },
          },
          required: ["parsedResume"],
        },
      },
      {
        name: "normalizeSkills",
        description: "Normalize candidate skills list to canonical standard names.",
        parameters: {
          type: "object",
          properties: {
            skills: {
              type: "array",
              items: { type: "string" },
              description: "Array of raw skill names",
            },
          },
          required: ["skills"],
        },
      },
      {
        name: "deterministicMatching",
        description: "Execute deterministic matching logic between candidate feature vector and job requirements.",
        parameters: {
          type: "object",
          properties: {
            candidate: {
              type: "object",
              properties: {
                experienceYears: { type: "number" },
                skills: { type: "array", items: { type: "string" } },
                location: { type: "string" },
              },
              required: ["experienceYears", "skills", "location"],
            },
            job: {
              type: "object",
              properties: {
                title: { type: "string" },
                location: { type: "string" },
                experienceMin: { type: "number" },
                experienceMax: { type: "number" },
                requiredSkills: { type: "array", items: { type: "string" } },
              },
              required: ["title", "location", "experienceMin"],
            },
          },
          required: ["candidate", "job"],
        },
      },
      {
        name: "calculateFinalScore",
        description: "Execute the mandatory deterministic scoring formula: (0.5 * skillMatchScore) + (0.3 * experienceMatchScore) + (0.2 * locationMatchScore).",
        parameters: {
          type: "object",
          properties: {
            skillMatchScore: { type: "number" },
            experienceMatchScore: { type: "number" },
            locationMatchScore: { type: "number" },
            breakdown: { type: "object" },
          },
          required: ["skillMatchScore", "experienceMatchScore", "locationMatchScore"],
        },
      },
    ];
  }

  public static async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case "parseResume":
        return await ResumeParserTool.parse({
          s3Key: args.s3Key,
          rawContentOverride: args.rawContent,
        });

      case "extractFeatures":
        return FeatureExtractorTool.extract(args.parsedResume);

      case "normalizeSkills":
        return SkillNormalizerTool.normalize(args.skills);

      case "deterministicMatching":
        return DeterministicMatchingTool.match(args.candidate, args.job);

      case "calculateFinalScore":
        return ScoringEngineTool.calculate(args);

      default:
        throw new Error(`Tool "${name}" is not registered in ToolRegistry.`);
    }
  }
}
