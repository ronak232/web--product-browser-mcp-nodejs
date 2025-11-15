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
      model: this.model,
      messages: [
        {
          role: "system",
          content: `You are a web assistant. Extract tools and args based on user query.
      User query: ${prompt}
      Available tools:

      * product-scraper: { search: string, limit?: number, minPrice?: number,       maxPrice?: number, minRating?: number }
        Output rules:
      * RETURN ONLY a valid JSON array (no explanation).
      * Each item: { "tool": "<tool-name>", "args": { ... } }.
      * Use the exact tool name "product-scraper".
      * Understand user price from prompt correctly in native currency (e.g., in India - ₹1.5 lakhs = 150000, in US - $800).
      * Detect and interpret price ranges and ratings (e.g., under, between, above,4.5 stars).
      * Handle queries in any language and convert values appropriately.
      * If parameters are missing, omit them from args.
      * Example: “Show me smartphones under ₹50,000 with at least 4.5 stars” →      [{"tool": "product-scraper", "args": {"search": "smartphones", "maxPrice:"50000, "minRating": 4.5}}].
          `,
        },
      ],
    });

    return llm.choices[0]?.message?.content ?? "";
  };
}
