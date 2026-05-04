import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface CallAnalysis {
  summary: string;
  sentiment: {
    sdr: number; // 0-100
    prospect: number; // 0-100
  };
  objections: {
    objection: string;
    handling: string;
    effectiveness: "low" | "medium" | "high";
  }[];
  bant: {
    budget: string;
    authority: string;
    need: string;
    timeline: string;
  };
  nextSteps: string[];
  feedback: {
    strengths: string[];
    improvements: string[];
    score: number; // 0-10
  };
}

export async function analyzeCall(transcript: string): Promise<CallAnalysis> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analise a seguinte transcrição de uma ligação de SDR e forneça uma análise estruturada em formato JSON. A análise deve ser feita em PORTUGUÊS.
    
    Transcrição:
    ${transcript}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "Resumo da ligação em português" },
          sentiment: {
            type: Type.OBJECT,
            properties: {
              sdr: { type: Type.NUMBER, description: "Pontuação de sentimento para o SDR de 0 a 100" },
              prospect: { type: Type.NUMBER, description: "Pontuação de sentimento para o Prospect de 0 a 100" }
            },
            required: ["sdr", "prospect"]
          },
          objections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                objection: { type: Type.STRING, description: "A objeção levantada" },
                handling: { type: Type.STRING, description: "Como foi tratada" },
                effectiveness: { type: Type.STRING, enum: ["low", "medium", "high"], description: "Eficácia do tratamento" }
              },
              required: ["objection", "handling", "effectiveness"]
            }
          },
          bant: {
            type: Type.OBJECT,
            properties: {
              budget: { type: Type.STRING, description: "Informações sobre orçamento" },
              authority: { type: Type.STRING, description: "Informações sobre autoridade" },
              need: { type: Type.STRING, description: "Informações sobre necessidade" },
              timeline: { type: Type.STRING, description: "Informações sobre cronograma" }
            },
            required: ["budget", "authority", "need", "timeline"]
          },
          nextSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING, description: "Próximos passos acionáveis" }
          },
          feedback: {
            type: Type.OBJECT,
            properties: {
              strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Pontos fortes do SDR" },
              improvements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "O que o SDR pode melhorar" },
              score: { type: Type.NUMBER, description: "Nota geral de performance de 0 a 10" }
            },
            required: ["strengths", "improvements", "score"]
          }
        },
        required: ["summary", "sentiment", "objections", "bant", "nextSteps", "feedback"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
