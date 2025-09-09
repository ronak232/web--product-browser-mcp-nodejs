import { Groq } from "groq-sdk";

export class ModelMCP {
  #model = "";
  #key = "";
  modelProvider = new Groq({
    apiKey: this.#key,
  });
  constructor(model: string, key: string) {
    this.#model = model;
    this.#key = key;
  }

  run = async (prompt: string) => {
    const llm = this.modelProvider.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a web assistant to help get the information from web what user asked in ${prompt} Schema: { "tool": string, "args": object }[]`,
          name: "mcp-system",
        },
      ],
      model: this.#model,
      response_format: {
        type: "json_object",
      },
    });

    return (await llm).choices[0].message.content || "";
  };
}
