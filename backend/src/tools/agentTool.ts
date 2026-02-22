// agent.ts
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ModelMCP } from "../../service/LlmMcp.js";
import fs from "fs";
import path from "path";

export async function callMCPClient(query: string) {
  // prefer running local tsx binary directly (don't call it via `node`)
  const projectRoot = process.cwd();
  const localTsxWin = path.join(projectRoot, "node_modules", ".bin", "tsx.cmd");
  const localTsxNix = path.join(projectRoot, "node_modules", ".bin", "tsx");

  const targetFile = path.resolve(
    projectRoot,
    "src",
    "tools",
    "fetchServer.ts"
  );

  // debug - helps verify resolution at runtime
  console.log("projectRoot:", projectRoot);
  console.log("targetFile:", targetFile);

  let command: string;
  let args: string[];

  if (fs.existsSync(localTsxWin) || fs.existsSync(localTsxNix)) {
    // Determine the path to the JS entry point of tsx to avoid cmd wrapper issues
    const tsxPackage = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");

    if (fs.existsSync(tsxPackage)) {
      command = "node";
      args = [tsxPackage, targetFile];
    } else {
      // Fallback to binary if package structure differs (unlikely)
      const tsxPath = fs.existsSync(localTsxWin) ? localTsxWin : localTsxNix;
      command = tsxPath;
      args = [targetFile];
    }
  } else {
    // fallback: run via shell and use absolute path to avoid cwd-relative duplication
    if (process.platform === "win32") {
      command = "cmd.exe";
      args = ["/c", `npx tsx "${targetFile}"`];
    } else {
      command = "sh";
      args = ["-c", `npx tsx "${targetFile}"`];
    }
  }

  const transport = new StdioClientTransport({
    command,
    args,
    stderr: "inherit"
  });
  // Debug command
  console.log(`Spawning MCP client with command: ${command} ${args.join(" ")}`);

  const client = new Client({
    name: "client-scraper",
    version: "1.0.0",
  });
  await client.connect(transport);

  const llm = new ModelMCP({
    model: "openai/gpt-oss-120b",
    apikey: process.env.GROQ_API_KEY || "",
  });

  const planRaw = await llm.run(query);
  console.log("LLM plan raw:", planRaw);

  let plan: { tool: string; args: any; displayLimit?: number }[];
  let finalResult: any = null;
  try {
    // Clean markdown wrapping if present
    let cleaned = planRaw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    plan = JSON.parse(cleaned);

    // Extract displayLimit from LLM plan (first step)
    let displayLimit = plan[0]?.displayLimit ?? 5;

    // Server-side fallback: detect "best/top" superlative patterns in user query
    const superlativeRegex = /\b(best|top|finest|greatest|leading|premium|ultimate)\b/i;
    const queryLower = query.toLowerCase();
    if (superlativeRegex.test(queryLower)) {
      displayLimit = Math.min(displayLimit, 3);
      console.log(`Superlative detected in query: "${query}" → displayLimit capped to 3`);
    }

    // Enforce hard caps
    displayLimit = Math.min(displayLimit, 5); // NEVER more than 5
    if (displayLimit < 1) displayLimit = 5;    // Fallback for bad LLM output

    console.log(`Display limit: ${displayLimit}`);

    // --- Smart Price Range Enforcement ---
    // If the LLM set a maxPrice but no meaningful minPrice (i.e. 0 or undefined),
    // it usually means the user said "under X" or "below X".
    // We apply a smart lower floor of 50% of maxPrice so results are close to budget.
    // e.g. "under 3500" → minPrice becomes 1750, so we only show ₹1750–₹3500.
    for (const step of plan) {
      if (step.tool === 'product-scraper' && step.args) {
        const { maxPrice, minPrice } = step.args;
        if (maxPrice && maxPrice > 0 && (!minPrice || minPrice === 0)) {
          const smartMin = Math.round(maxPrice * 0.5);
          step.args.minPrice = smartMin;
          console.log(`Smart price floor applied: minPrice set to ₹${smartMin} (50% of maxPrice ₹${maxPrice})`);
        }
      }
    }

    for (const step of plan) {
      console.log(`Calling tool: ${step.tool}`, step.args);
      const result: any = await client.callTool({
        name: step.tool,
        arguments: step.args,
      });
      console.log("Tool result:", result);
      if (result.content && result.content[0]?.type === "text") {
        finalResult = JSON.parse(result.content[0].text);
      } else {
        // Fallback if the structure is different
        finalResult = result.content;
      }
    }

    // Post-processing for Best Deals
    if (finalResult && finalResult.items && Array.isArray(finalResult.items)) {
      finalResult.items = finalResult.items.map((item: any) => {
        // Calculate score: discount * 0.6 + rating * 8
        const discount = item.discountPercent || 0;
        const rating = item.rating || 0;
        const score = (discount * 0.6) + (rating * 8);
        return { ...item, dealScore: score };
      });

      // Sort by score
      finalResult.items.sort((a: any, b: any) => b.dealScore - a.dealScore);

      // Mark top 3 as "Best Deal" if score is decent (e.g. > 10)
      for (let i = 0; i < Math.min(3, finalResult.items.length); i++) {
        if (finalResult.items[i].dealScore > 10) {
          finalResult.items[i].isBestDeal = true;
        }
      }

      // Enforce display limit: slice visible items, hold extras
      const allItems = finalResult.items;
      finalResult.items = allItems.slice(0, displayLimit);
      finalResult.count = finalResult.items.length;
      finalResult.displayLimit = displayLimit;

      // If there are more items beyond the display limit, include them as _extra
      if (allItems.length > displayLimit) {
        finalResult._extra = allItems.slice(displayLimit);
        finalResult._totalAvailable = allItems.length;
        finalResult.hasMore = true;
      } else {
        finalResult.hasMore = false;
      }
    }
  } catch (err) {
    console.error("Error in agentTool:", err);
    // Ensure client is disconnected even on error
    await transport.close();
    throw new Error("Failed to execute tool plan. Check logs for details.");
  } finally {
    await transport.close();
  }
  return finalResult;
}



export async function findBetterAlternative(currentProduct: any, allProducts: any[]) {
  // Logic: Find product with higher rating and lower price
  if (!currentProduct || !currentProduct.price || !currentProduct.rating) return null;

  const better = allProducts.find(p =>
    p.asin !== currentProduct.asin &&
    p.rating >= currentProduct.rating &&
    p.price < currentProduct.price &&
    p.price > 0 // Ensure valid price
  );

  // If multiple, pick the one with max rating, then lowest price
  if (better) {
    // Simple heuristic for now, just return the first good match or iterate to find best
    const candidates = allProducts.filter(p =>
      p.asin !== currentProduct.asin &&
      p.rating >= currentProduct.rating &&
      p.price < currentProduct.price
    );
    candidates.sort((a, b) => b.rating - a.rating || a.price - b.price);
    return candidates.length > 0 ? candidates[0] : null;
  }

  return null;
}

export async function compareProducts(products: any[]) {
  // Limit to 3 products to save tokens
  const topProducts = products.slice(0, 3);

  // Use the same LLM instance or create new one
  const llm = new ModelMCP({
    model: "openai/gpt-oss-120b",
    apikey: process.env.GROQ_API_KEY || "",
  });

  const comparisonRaw = await llm.compare(topProducts);
  try {
    return JSON.parse(comparisonRaw); // Expecting JSON array
  } catch (e) {
    console.error("Failed to parse comparison JSON", comparisonRaw);
    return [];
  }
}
