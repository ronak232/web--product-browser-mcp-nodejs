import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config({
  override: true,
});
export class ModelMCP {
  private model: string;
  private apikey: string;
  private modelProvider: Groq;

  constructor({ model, apikey }: { model: string; apikey: string }) {
    this.model = model;
    this.apikey = apikey;
    this.modelProvider = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  run = async (prompt: string) => {
    const llm = await this.modelProvider.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a web assistant. Extract tools and args based on user query.\nUser query: ${prompt}\n 
          Available tools:
          - product-scraper: { search: string, limit?: number, minPrice?: number, maxPrice?: number, minRating?: number }
          Output rules:
          - RETURN ONLY a valid JSON array (no explanation).
          - Each item: { "tool": "<tool-name>", "args": { ... } }.
          - Use the exact tool name "product-scraper".`,
        },
      ],
      model: this.model,
    });

    return llm.choices[0]?.message?.content ?? "";
  };
}
