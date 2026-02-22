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

      * product-scraper: { search: string, limit?: number, minPrice?: number, maxPrice?: number, minRating?: number, platform?: 'amazon' | 'flipkart' | 'all' }
        Output rules:
      * RETURN ONLY a valid JSON array (no explanation).
      * Each item: { "tool": "<tool-name>", "args": { ... }, "displayLimit": <number> }.
      * Use the exact tool name "product-scraper".
      * Understand user price from prompt correctly in native currency (e.g., in India - ₹1.5 lakhs = 150000, in US - $800).
      * Detect and interpret price ranges and ratings (e.g., under, between, above, 4.5 stars).
      * Handle queries in any language and convert values appropriately.
      * If parameters are missing, omit them from args.

      RESULT LIMIT RULES (CRITICAL):
      * Always set "limit" in args to at least 5 (scrape 5 to rank from).
      * If the user says "best", "top", "finest", "greatest", or any superlative followed by a number N (e.g., "best 5", "top 10"), set "displayLimit" to 3 (show only the cream).
      * If the user does NOT use superlative words, set "displayLimit" to 5.
      * If the user explicitly asks for more than 5 results (e.g., "show 10"), set "displayLimit" to 5 (we will ask the user before showing more).
      * NEVER set displayLimit above 5.

      Examples:
      * "gaming keyboard" → [{"tool": "product-scraper", "args": {"search": "gaming keyboard", "limit": 5}, "displayLimit": 5}]
      * "best 5 wireless earbuds under 2000" → [{"tool": "product-scraper", "args": {"search": "wireless earbuds", "maxPrice": 2000, "limit": 5}, "displayLimit": 3}]
      * "top 10 laptops" → [{"tool": "product-scraper", "args": {"search": "laptops", "limit": 10}, "displayLimit": 3}]
      * "show me smartphones under ₹50,000 with at least 4.5 stars" → [{"tool": "product-scraper", "args": {"search": "smartphones", "maxPrice": 50000, "minRating": 4.5, "limit": 5}, "displayLimit": 5}]
          `,
        },
      ],
    });

    return llm.choices[0]?.message?.content ?? "";
  };

  compare = async (products: any[]) => {
    const prompt = `
      Compare the following products and provide a summary of Pros, Cons, and a "Best for" recommendation for each.
      
      Products:
      ${JSON.stringify(products, null, 2)}
      
      Output Format (JSON Array):
      [
          {
              "asin": "...",
              "pros": ["pro1", "pro2"],
              "cons": ["con1", "con2"],
              "bestFor": "Target Audience/Usage (e.g. Competitive Gaming)"
          }
      ]
      RETURN ONLY JSON.
      `;

    const llm = await this.modelProvider.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
    });

    return llm.choices[0]?.message?.content ?? "[]";
  };
}
