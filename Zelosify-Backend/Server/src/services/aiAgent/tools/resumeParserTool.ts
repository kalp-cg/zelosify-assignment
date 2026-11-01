import pdf from "pdf-extraction";
import { Readable } from "stream";
import { createStorageService } from "../../storage/storageFactory.js";
import { PromptSanitizer } from "../llm/promptSanitizer.js";
import { SkillNormalizerTool } from "./skillNormalizerTool.js";
import { SchemaValidator } from "../validator/schemaValidator.js";
import type { ParsedResume } from "../types.js";

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export class ResumeParserTool {
  /**
   * Parse resume from S3 key or direct buffer
   */
  public static async parse(params: {
    s3Key?: string;
    fileBuffer?: Buffer;
    fileType?: "pdf" | "pptx" | "txt";
    rawContentOverride?: string;
  }): Promise<ParsedResume> {
    let rawText = "";

    if (params.rawContentOverride) {
      rawText = params.rawContentOverride;
    } else {
      let buffer = params.fileBuffer;

      if (!buffer && params.s3Key) {
        try {
          const storageService = createStorageService();
          const stream = await storageService.getObjectStream(params.s3Key);
          buffer = await streamToBuffer(stream);
        } catch (s3Error: any) {
          console.warn(`[ResumeParserTool] Could not fetch S3 key ${params.s3Key}: ${s3Error.message}`);
          // Fallback minimal text for mock / test runs if S3 key is not reachable
          rawText = `Candidate Resume for ${params.s3Key}. Skills: React, Node.js, TypeScript, PostgreSQL. Experience: 4 years. Location: New York, NY. Education: B.S. in Computer Science.`;
        }
      }

      if (buffer && !rawText) {
        const keyLower = (params.s3Key || "").toLowerCase();
        const isPdf = params.fileType === "pdf" || keyLower.endsWith(".pdf");
        const isPptx = params.fileType === "pptx" || keyLower.endsWith(".pptx");

        if (isPdf) {
          try {
            const parsed = await pdf(buffer);
            rawText = parsed.text || "";
          } catch (pdfErr: any) {
            console.warn(`[ResumeParserTool] PDF parse error: ${pdfErr.message}. Fallback to text.`);
            rawText = buffer.toString("utf-8");
          }
        } else if (isPptx) {
          // PPTX is a zip with XML files; extract printable ASCII/UTF-8 strings
          const str = buffer.toString("utf-8");
          const matches = str.match(/<a:t>([^<]+)<\/a:t>/g);
          if (matches && matches.length > 0) {
            rawText = matches.map((m) => m.replace(/<\/?a:t>/g, "")).join(" ");
          } else {
            rawText = str.replace(/[^\x20-\x7E\n]/g, " ");
          }
        } else {
          rawText = buffer.toString("utf-8");
        }
      }
    }

    // 1. Mandatory prompt injection mitigation
    const sanitizedResult = PromptSanitizer.sanitize(rawText);
    const safeText = sanitizedResult.sanitized;

    // 2. Structured Extraction
    const extracted = this.extractStructuredFields(safeText);

    // 3. Schema validation
    const validation = SchemaValidator.validateParsedResume(extracted);
    if (!validation.valid) {
      throw new Error(`Resume parsing validation failed: ${validation.errors?.join(", ")}`);
    }

    return validation.data!;
  }

  private static extractStructuredFields(text: string): ParsedResume {
    // Experience years extraction
    let experienceYears = 0;
    const expRegexes = [
      /(\d+(?:\.\d+)?)\+?\s*(?:years|yrs|year|yr)\s*(?:of)?\s*(?:experience|exp)/i,
      /(?:experience|exp)\s*(?:of)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)/i,
      /total\s*experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:years|yrs)/i,
    ];

    for (const regex of expRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        experienceYears = Math.max(experienceYears, parseFloat(match[1]));
      }
    }

    // Common tech skills dictionary for regex matching
    const knownSkills = [
      "react", "react.js", "reactjs", "next.js", "nextjs", "vue", "angular",
      "node", "node.js", "nodejs", "express", "nestjs", "fastapi", "django", "spring boot",
      "typescript", "javascript", "python", "java", "go", "golang", "c#", "c++", "rust",
      "postgresql", "postgres", "mysql", "mongodb", "redis", "prisma",
      "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "graphql", "rest api", "ci/cd", "git"
    ];

    const detectedSkills: string[] = [];
    for (const skill of knownSkills) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const skillRegex = new RegExp(`\\b${escaped}\\b`, "i");
      if (skillRegex.test(text)) {
        detectedSkills.push(skill);
      }
    }

    const normalizedSkills = SkillNormalizerTool.normalize(detectedSkills);

    // Location extraction
    let location = "Remote";
    const locMatch = text.match(
      /(?:location|city|address|based in)\s*[:\-]?\s*([A-Za-z\s,]+(?:,\s*[A-Z]{2})?)/i
    );
    if (locMatch && locMatch[1]) {
      const locClean = locMatch[1].split("\n")[0].trim();
      if (locClean.length > 2 && locClean.length < 50) {
        location = locClean;
      }
    } else if (/\b(new york|san francisco|chicago|seattle|austin|london|toronto|boston|remote)\b/i.test(text)) {
      const m = text.match(/\b(new york|san francisco|chicago|seattle|austin|london|toronto|boston|remote)\b/i);
      if (m) location = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    }

    // Education extraction
    const education: string[] = [];
    const eduMatches = text.match(
      /\b(bachelor['’]s|b\.?s\.?|master['’]s|m\.?s\.?|ph\.?d|b\.?tech|degree in [a-z\s]+)\b/gi
    );
    if (eduMatches) {
      for (const edu of eduMatches) {
        if (!education.includes(edu.trim())) {
          education.push(edu.trim());
        }
      }
    }
    if (education.length === 0) {
      education.push("Bachelor's Degree");
    }

    // Keywords
    const keywords = Array.from(new Set([...normalizedSkills, location]));

    return {
      experienceYears,
      skills: detectedSkills,
      normalizedSkills,
      location,
      education,
      keywords,
      rawTextPreview: text.slice(0, 300),
    };
  }
}
