
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, JobOpportunity } from "./types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const extractProfileFromCV = async (cvText: string): Promise<UserProfile> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Extract key professional information from this CV text. Return as JSON. 
    CV Text: ${cvText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          title: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          experience: { type: Type.STRING, description: "Brief summary of work history" },
          location: { type: Type.STRING },
        },
        required: ["name", "title", "skills", "experience", "location"]
      }
    }
  });

  const data = JSON.parse(response.text || '{}');
  return { ...data, cvText };
};

export const searchJobs = async (profile: UserProfile): Promise<JobOpportunity[]> => {
  const ai = getAI();
  const prompt = `Find 5 active job openings for a ${profile.title} with skills in ${profile.skills.join(", ")} in ${profile.location}. 
  Focus on high-match roles. Provide URLs and basic details.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  // Extract grounding metadata for URLs
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const searchResults = chunks.map((chunk: any, index: number) => ({
    id: `job-${index}-${Date.now()}`,
    title: chunk.web?.title || "Unknown Role",
    company: "Found via Search",
    location: profile.location,
    url: chunk.web?.uri || "#",
    descriptionSnippet: response.text || "No description available",
    fitScore: 0,
    matchAnalysis: "",
    status: 'new' as const,
  }));

  // Limit to unique-ish URLs and ensure we have some results
  return searchResults.filter((job: any) => job.url !== "#").slice(0, 5);
};

export const analyzeJobFit = async (job: JobOpportunity, profile: UserProfile): Promise<{ score: number, analysis: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the fit between this candidate and this job.
    Candidate CV: ${profile.cvText}
    Job Title: ${job.title}
    Job Source/Text: ${job.descriptionSnippet}
    
    Return a fit score (0-100) and a brief analysis.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          analysis: { type: Type.STRING },
        },
        required: ["score", "analysis"]
      }
    }
  });

  return JSON.parse(response.text || '{"score": 0, "analysis": "Error parsing"}');
};

export const draftCoverLetter = async (job: JobOpportunity, profile: UserProfile): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Write a highly personalized, professional, and concise application email (Cover Letter) for the following job.
    Job: ${job.title} at ${job.company}
    Candidate: ${profile.name}, a ${profile.title}
    Experience Summary: ${profile.experience}
    Top Skills: ${profile.skills.join(", ")}
    
    Make it enthusiastic but respectful. Use a professional tone.`,
  });

  return response.text || "";
};
