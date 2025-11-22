
import { GoogleGenAI } from "@google/genai";
import { AppSection, WebSource } from "../types";
import { SYSTEM_INSTRUCTIONS } from "../constants";

// We initialize the client lazily to ensure we have the API key
let genAI: GoogleGenAI | null = null;

const getClient = () => {
  if (!genAI) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
};

interface GeminiResponse {
  text: string;
  sources: WebSource[];
}

export const generateResponse = async (
  prompt: string,
  attachmentBase64: string | undefined,
  section: AppSection
): Promise<GeminiResponse> => {
  try {
    const client = getClient();
    const modelId = "gemini-2.5-flash"; 
    
    // Append JSON instruction to ensure we can extract vocabulary
    const baseInstruction = SYSTEM_INSTRUCTIONS[section] || SYSTEM_INSTRUCTIONS[AppSection.READING];
    const jsonInstruction = `
    
    IMPORTANT: At the very end of your response, AFTER all explanations, strictly provide a JSON block containing the key vocabulary from this lesson. 
    Do not wrap the JSON in markdown code blocks like \`\`\`json ... \`\`\`. Just output the raw JSON string at the end.
    The format must be:
    {
      "vocabulary": [
        { "kanji": "Word in Kanji", "kana": "Hiragana/Katakana Reading", "romaji": "Romaji Reading", "meanings": "Myanmar meaning" }
      ]
    }
    If there is no specific vocabulary to extract, return { "vocabulary": [] }.
    `;

    const systemInstruction = baseInstruction + jsonInstruction;

    let contents: any = null;

    if (attachmentBase64) {
      // Robust Base64 parsing (Memory efficient - avoids regex on full string)
      let mimeType = "image/jpeg"; // Default fallback
      let data = attachmentBase64;

      const commaIndex = attachmentBase64.indexOf(',');
      if (commaIndex !== -1) {
        // Parse Header: data:application/pdf;base64
        const header = attachmentBase64.slice(0, commaIndex);
        const mimeMatch = header.match(/^data:(.*);base64$/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
        // Extract Data (Slice is safer than split for large strings)
        data = attachmentBase64.slice(commaIndex + 1);
      } else {
        // Handle raw base64 case if no header exists
        data = attachmentBase64; 
      }
      
      // Specific prompt handling for PDFs to ensure full context usage
      let finalPrompt = prompt || "Please analyze this document/image based on the section context.";
      if (mimeType === "application/pdf") {
        finalPrompt = `Based on the entire content of the attached PDF document (all pages), please answer: ${finalPrompt}`;
      }

      contents = {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: data,
            },
          },
          {
            text: finalPrompt,
          },
        ],
      };
    } else {
      contents = {
        role: "user",
        parts: [{ text: prompt }],
      };
    }

    const response = await client.models.generateContent({
      model: modelId,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.4, // Slightly lower for educational accuracy
        tools: [{ googleSearch: {} }], // Enable Search Grounding
      },
      contents: [contents],
    });

    const text = response.text || "Sorry, I couldn't generate a response.";
    
    // Extract Grounding Metadata (Sources)
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: WebSource[] = [];

    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || "Web Source",
            uri: chunk.web.uri || "#"
          });
        }
      });
    }

    return { text, sources };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "An error occurred while communicating with the AI.");
  }
};
