import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || 'missing' });

export async function generateProjectionImage(prompt: string): Promise<string> {
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable.");
  }
  
  const response = await ai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '16:9',
      outputMimeType: 'image/jpeg',
    }
  });
  
  if (!response.generatedImages || response.generatedImages.length === 0) {
    throw new Error("No image was generated.");
  }

  const base64 = response.generatedImages[0].image.imageBytes;
  return `data:image/jpeg;base64,${base64}`;
}
