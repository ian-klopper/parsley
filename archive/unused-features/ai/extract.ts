
import { extract } from "@genkit-ai/ai-embed";
import { defineFlow } from "@genkit-ai/flow";
import { geminiPro } from "@genkit-ai/googleai";
import * as z from "zod";

export const ExtractedDataSchema = z.object({
  items: z.array(
    z.object({
      category: z.string().describe("The category of the item"),
      description: z.string().describe("A detailed description of the item"),
      quantity: z.number().describe("The quantity of the item"),
      price: z.number().describe("The price of the item"),
    })
  ),
});

export const extractionFlow = defineFlow(
  {
    name: "extractionFlow",
    inputSchema: z.string(),
    outputSchema: ExtractedDataSchema,
  },
  async (receipt) => {
    const llmResponse = await extract({
      llm: geminiPro,
      prompt: `You are an expert data extractor. Your task is to analyze the provided receipt and extract all relevant items, including their descriptions, quantities, and prices. Please categorize each item appropriately based on the information available in the receipt.\n\nReceipt:\n${receipt}`,
      schema: ExtractedDataSchema,
    });

    return llmResponse;
  }
);

