import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface VisionText {
  text: string;
  confidence?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface VisionLogo {
  description: string;
  score: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface VisionLabel {
  description: string;
  score: number;
}

interface VisionObject {
  name: string;
  score: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ImageAnalysisResult {
  labels: VisionLabel[];
  objects: VisionObject[];
  texts: VisionText[];
  logos: VisionLogo[];
}


class VisionService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY || '';
    if (!this.apiKey) {
      console.error('GOOGLE_CLOUD_VISION_API_KEY is not set in environment variables');
    }
  }
 

  public async getImageAnalysis(imageUrl: string): Promise<{
    labels: string[];
    objects: VisionObject[];
    texts: VisionText[];
    logos: VisionLogo[];
  }> {
    try {
      const analysisResult = await this.analyzeImage(imageUrl);
      
      if (!analysisResult) {
        return { labels: [], objects: [], texts: [], logos: [] };
      }
      
      return {
        labels: analysisResult.labels.map(label => label.description),
        objects: analysisResult.objects,
        texts: analysisResult.texts,
        logos: analysisResult.logos
      };
    } catch (error) {
      console.error('Error getting image analysis:', error);
      return { labels: [], objects: [], texts: [], logos: [] };
    }
  }

  private calculateBoundingBox(vertices: Array<{ x?: number; y?: number; }> | undefined): { x: number; y: number; width: number; height: number; } | undefined {
    if (!vertices || vertices.length < 4) {
      return undefined;
    }

    try {
      const x = vertices[0]?.x || 0;
      const y = vertices[0]?.y || 0;
      const width = Math.abs((vertices[1]?.x || x) - x);
      const height = Math.abs((vertices[2]?.y || y) - y);

      return { x, y, width, height };
    } catch (error) {
      console.error('Error calculating bounding box:', error);
      return undefined;
    }
  }

  private async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult | null> {
    if (!this.apiKey) {
      console.error('Cannot analyze image: API key is not configured');
      return null;
    }

    try {
      const urlObj = new URL(imageUrl);
      const publicPath = urlObj.pathname.replace('/public', '');
      const imagePath = path.join(
        process.cwd(),
        'public',
        publicPath
      );
      const imageBuffer = fs.readFileSync(imagePath);
      const imageContent = imageBuffer.toString('base64');
      const requestBody = {
        requests: [{
          image: {
            content: imageContent
          },
          features: [
            { 
              type: 'LABEL_DETECTION',
              maxResults: 20, 
              model: 'builtin/latest'
            },
            { 
              type: 'OBJECT_LOCALIZATION',
              maxResults: 20, 
              model: 'builtin/latest'
            },
            {
              type: 'IMAGE_PROPERTIES', 
              maxResults: 20
            },
            {
              type: 'CROP_HINTS' 
            },
            {
              type: 'TEXT_DETECTION',
              maxResults: 20,
              model: 'builtin/latest'
            },
            {
              type: 'LOGO_DETECTION',
              maxResults: 20,
              model: 'builtin/latest'
            },
          ],
          imageContext: {
            languageHints: ['en'],  
            cropHintsParams: {
              aspectRatios: [1.0] 
            }
          }
        }]
      };

      const response = await axios.post(
        'https://vision.googleapis.com/v1/images:annotate',
        requestBody,
        {
          params: {
            key: this.apiKey
          },
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000  
        }
      );

      if (!response.data?.responses?.[0]) {
        throw new Error('Invalid response from Vision API');
      }

      const result = response.data.responses[0];

      const analysisResult: ImageAnalysisResult = {
        labels: (result.labelAnnotations || []).map((label: { description: string; score: number; topicality?: number }) => ({
          description: label.description || '',
          score: Math.max(label.score || 0, label.topicality || 0)
        })),
        objects: (result.localizedObjectAnnotations || []).map((obj: { 
          name: string; 
          score: number; 
          boundingPoly?: {
            normalizedVertices: Array<{ x?: number; y?: number; }>
          }
        }) => ({
          name: obj.name || '',
          score: obj.score || 0,
          boundingBox: this.calculateBoundingBox(obj.boundingPoly?.normalizedVertices)
        })),
        texts: (result.textAnnotations || []).map((text: { 
          description: string; 
          score: number; 
          boundingPoly?: { 
            normalizedVertices: Array<{ x?: number; y?: number; }> 
          } 
        }) => ({
          text: text.description || '',
          confidence: text.score || 0,
          boundingBox: this.calculateBoundingBox(text.boundingPoly?.normalizedVertices)
        })),
        logos: (result.logoAnnotations || []).map((logo: { 
          description: string; 
          score: number; 
          boundingPoly?: { 
            normalizedVertices: Array<{ x?: number; y?: number; }> 
          } 
        }) => ({
          description: logo.description || '',
          score: logo.score || 0,
          boundingBox: this.calculateBoundingBox(logo.boundingPoly?.normalizedVertices)
        }))
      };

      return analysisResult;
    } catch (error) {
      console.error('Error analyzing image:', error);
      return null;
    }
  }

}

const visionService = new VisionService();

export default visionService; 