import express from "express";
import { callMCPClient, findBetterAlternative, compareProducts } from "../src/tools/agentTool.js";

const router = express.Router();

router.post("/api/get", async (req, res) => {
  const { query } = req.body;
  console.log(`Received API request for query: "${query}"`);

  if (!query || typeof query !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Query is required." });
  }

  try {
    const data = await callMCPClient(query);
    console.log("Successfully retrieved data, sending to client.");
    return res.json({ success: true, data });
  } catch (err: any) {
    console.error("API route error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error." });
  }
});

router.post("/api/better-alternative", async (req, res) => {
  const { product, allProducts } = req.body;
  if (!product || !allProducts) {
    return res.status(400).json({ success: false, message: "Missing product data." });
  }

  try {
    const result = await findBetterAlternative(product, allProducts);
    return res.json({ success: true, data: result });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/api/compare", async (req, res) => {
  const { products } = req.body;
  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ success: false, message: "Missing products array." });
  }

  try {
    const result = await compareProducts(products);
    return res.json({ success: true, data: result });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});


export default router;
