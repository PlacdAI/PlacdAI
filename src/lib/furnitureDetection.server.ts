// Server-only: the actual Gemini call behind "what furniture is in this
// photo." Extracted out of the /api/detect-furniture route so that
// swap-product's post-edit verification step can call the exact same
// detection logic — same prompt, same schema, same filtering — instead of
// a second, differently-worded verifier that could disagree with the first.
import { dataUrlToInline, geminiJson } from "@/lib/gemini.server";
import type { DetectedItem } from "./furnitureMatching";

// 🔧 MODEL PIN — do NOT let this fall through to geminiJson's shared
// default (gemini-3.1-flash-lite). Unlike pick-products (pick 1-3 IDs
// from a list you hand it — easy for a lite model), this call has to
// do real open-ended object detection AND produce tight percentage-
// based bounding boxes across an entire photo. That's genuine spatial
// grounding, a meaningfully harder capability than structured text
// extraction, and lite-tier models are noticeably weaker at it. The
// failure mode was silent: a syntactically valid, schema-compliant
// response with a near-empty `items` array — no error thrown, since
// nothing technically failed. Pin explicitly to a non-lite model,
// same reasoning gemini.server.ts already documents for the image
// model (lite image variant isn't reliable for the harder editing
// tasks in swap-product.ts either).
//
// NOTE: there is no plain "gemini-3.1-flash" — that generation only
// shipped Lite and Image variants.
//
// 🧪 CURRENTLY TESTING: gemini-3.5-flash-lite (released July 2026).
// ~70% cheaper than gemini-3.5-flash ($0.30/$2.50 vs $1.50/$9.00 per
// 1M tokens), and a full generation newer than the 3.1 Flash-Lite that
// caused the original near-empty-items failure above — but on raw
// object-detection benchmarks it still trails plain gemini-3.5-flash,
// so this is a real quality tradeoff being tested, not a guaranteed
// safe swap. Watch for: fewer items detected than before, or looser/
// larger boxes than before. If either shows up, flip back via env —
// no code edit needed:
//   FURNITURE_DETECTION_MODEL=gemini-3.5-flash
const FURNITURE_DETECTION_MODEL =
  process.env.FURNITURE_DETECTION_MODEL ?? "gemini-3.5-flash";

export async function detectFurniture(imageDataUrl: string): Promise<DetectedItem[]> {
  const inline = dataUrlToInline(imageDataUrl);

  const result = await geminiJson<{ items: DetectedItem[] }>({
    model: FURNITURE_DETECTION_MODEL,
    systemInstruction:
      "You detect furniture and decor items in a photo of a staged room, for an e-commerce 'shop this look' feature. ONLY include actual furniture and decor: sofas, chairs, tables, lamps, rugs, art/mirrors, plants, shelving, storage pieces, pillows, curtains. NEVER include architectural elements: walls, windows, doors, floors, ceilings, fireplaces, built-in fixtures. Give each item a short label (e.g. 'rattan coffee table'), a one-word category (e.g. 'table', 'chair', 'lamp', 'rug', 'art', 'storage', 'plant', 'lighting', 'decor'), and a tight bounding box as percentages of image width/height (0-100), where the box hugs only that item — not the wall or floor behind it.",
    parts: [
      { inlineData: inline },
      { text: "Identify the distinct furniture and decor items visible in this room photo." },
    ],
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              category: { type: "string" },
              bbox: {
                type: "object",
                properties: {
                  xPct: { type: "number" },
                  yPct: { type: "number" },
                  wPct: { type: "number" },
                  hPct: { type: "number" },
                },
                required: ["xPct", "yPct", "wPct", "hPct"],
              },
            },
            required: ["label", "category", "bbox"],
          },
        },
      },
      required: ["items"],
    },
  });

  // Basic sanity filtering: drop boxes that are absurdly large (near-
  // fullscreen — almost always a mislabeled architectural element that
  // slipped through) or degenerate (zero-size).
  return (result.items ?? []).filter((it) => {
    const area = (it.bbox.wPct * it.bbox.hPct) / 10000;
    return area > 0.001 && area < 0.6;
  });
}