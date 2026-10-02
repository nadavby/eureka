import { GoogleGenerativeAI, GenerativeModel, Part } from "@google/generative-ai";
import { IItem } from "../models/item_model";

type IItemWithTimestamps = IItem & {
  createdAt?: Date;
  updatedAt?: Date;
};

interface VisionSummary {
  labels: string[];
  objects: Array<{
    name: string;
    score: number;
  }>;
  texts: string[];
  logos: string[];
}

interface ItemLocation {
  lat?: number;
  lng?: number;
  address?: string;
}

interface ItemData {
  description: string;
  category: string;
  brand: string;
  colors: string[];
  condition: string;
  flaws: string;
  material: string;
  location: ItemLocation;
  date: string;
  visionSummary: VisionSummary;
}

interface MatchEvaluationRequest {
  instruction: {
    task: string;
    outputFormat: {
      type: "json";
      fields: {
        confidenceScore: "number (0-100)";
        reasoning: "string explaining the match evaluation";
      };
    };
    matchingCriteria: string[];
  };
  data: {
    lostItem: ItemData;
    foundItem: ItemData;
  };
}

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash"  // Using flash model for better quota limits
    });
  }
  
  private extractVisionSummary(visionApiData: any): VisionSummary {
    try {
      return {
        labels: Array.isArray(visionApiData?.labels) ? visionApiData.labels.slice(0, 10) : [],
        objects: Array.isArray(visionApiData?.objects) ? visionApiData.objects.map((obj: any) => ({
          name: obj?.name || 'unknown',
          score: typeof obj?.score === 'number' ? obj.score : 0
        })) : [],
        texts: Array.isArray(visionApiData?.texts) ? visionApiData.texts.map((text: any) => text?.text || '').filter(Boolean) : [],
        logos: Array.isArray(visionApiData?.logos) ? visionApiData.logos.map((logo: any) => logo?.description || '').filter(Boolean) : [],
      };
    } catch (error) {
      console.error('Error extracting vision summary:', error);
      return {
        labels: [],
        objects: [],
        texts: [],
        logos: [],
      };
    }
  }

  private prepareItemData(item: IItem): ItemData {
    const location = typeof item.location === 'string' ? {} as ItemLocation : (item.location || {}) as ItemLocation;
    
    return {
      description: item.description || 'N/A',
      category: item.category || 'N/A',
      brand: item.brand || 'N/A',
      colors: item.colors || [],
      condition: item.condition || 'N/A',
      flaws: item.flaws || 'N/A',
      material: item.material || 'N/A',
      location,
      date: (item as IItemWithTimestamps).createdAt?.toLocaleString() || 'N/A',
      visionSummary: this.extractVisionSummary(item.visionApiData)
    };
  }

  async evaluateMatch(
    lostItem: IItem, 
    foundItem: IItem,
  ): Promise<{ confidenceScore: number; reasoning: string }> {
    try {
      const request: MatchEvaluationRequest = {
        instruction: {
          task: "Evaluate whether the LOST and FOUND items refer to the same object based on their characteristics and metadata.",
          outputFormat: {
            type: "json",
            fields: {
              confidenceScore: "number (0-100)",
              reasoning: "string explaining the match evaluation"
            }
          },
          matchingCriteria: [
            "Compare descriptions for semantic similarity",
            "Check if categories are exact matches or related",
            "Verify brand names, including model variants",
            "Compare colors and materials",
            "Evaluate condition and specific flaws",
            "Analyze vision data (labels, objects, texts, logos)",
            "Consider temporal sequence (found date after lost date)",
            "Assess geographic proximity of locations"
          ]
        },
        data: {
          lostItem: this.prepareItemData(lostItem),
          foundItem: this.prepareItemData(foundItem)
        }
      };

      const parts: Part[] = [
        {
          text: `
Task: ${request.instruction.task}

Output Format: Return a JSON object with:
- confidenceScore: number between 0-100
- reasoning: detailed explanation of the match evaluation

Matching Criteria:
${request.instruction.matchingCriteria.map(c => '- ' + c).join('\n')}

Items to Compare:

LOST ITEM:
${JSON.stringify(request.data.lostItem, null, 2)}

FOUND ITEM:
${JSON.stringify(request.data.foundItem, null, 2)}

Analyze the items and return ONLY a JSON response in the format:
{
  "confidenceScore": number,
  "reasoning": "detailed explanation"
}`
        } as Part
      ];

      const result = await this.model.generateContent(parts);
      const responseText = result.response.text().trim();
      
      try {
        let cleanedResponse = responseText;
        cleanedResponse = cleanedResponse.replace(/```json\s+|\s+```|```/g, '');
        cleanedResponse = cleanedResponse.replace(/`/g, '');
        
        const parsedResponse = JSON.parse(cleanedResponse);
        
        if (typeof parsedResponse.confidenceScore !== 'number' || typeof parsedResponse.reasoning !== 'string') {
          console.error("Invalid response structure from Gemini:", parsedResponse);
          return { confidenceScore: 0, reasoning: "" };
        }
        
        const confidenceScore = Math.min(100, Math.max(0, parsedResponse.confidenceScore));
        return { confidenceScore, reasoning: parsedResponse.reasoning };
      } catch (error) {
        console.error("Error parsing Gemini response:", error);
        console.error("Raw response:", responseText);
        return { confidenceScore: 0, reasoning: "" };
      }
    } catch (error) {
      if ((error as any).status === 429) {
        console.error("Rate limit exceeded. Please try again in a few seconds.");
        return { 
          confidenceScore: 0, 
          reasoning: "Rate limit exceeded. Please try again in a few seconds." 
        };
      }
      console.error("Error in evaluateMatch:", error);
      return { confidenceScore: 0, reasoning: "" };
    }
  }
}

const geminiService = new GeminiService();

export default geminiService;
