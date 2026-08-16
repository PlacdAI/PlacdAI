// Server-only: cheap classification of "does this photo show a full room
// with real open floor space, or a small/transitional area (stair
// landing, hallway corner, entryway nook, narrow alcove) that can't
// realistically fit large furniture?"
//
// This exists because relying on the user's own prompt text to signal
// "this is a small space" (see the smallSpaceKeywords check in
// generate-room-background.ts) turned out to be unreliable — a user can
// easily type "decorate this area" with no size-indicating word at all,
// and get a full-size dresser crammed into a stair landing anyway. This
// call looks at the actual photo instead, so the small-space constraint
// no longer depends on the user remembering to describe the space in a
// particular way.
//
// Deliberately a lightweight lite-tier model, unlike detectFurniture's
// pinned non-lite model in furnitureDetection.server.ts. That call needs
// genuine spatial grounding (tight per-item bounding boxes across a whole
// photo) — a meaningfully harder capability. This call is a single coarse
// binary judgment ("does this space have real open floor area or not"),
// much closer to simple classification than fine-grained spatial
// reasoning, so a lite model should be reliable here at a fraction of the
// cost. If misclassifications show up in practice, flip to a non-lite
// model via env — no code edit needed:
//   SPACE_CLASSIFICATION_MODEL=gemini-3.5-flash
import { dataUrlToInline, geminiJson } from "@/lib/gemini.server";

const SPACE_CLASSIFICATION_MODEL =
  process.env.SPACE_CLASSIFICATION_MODEL ?? "gemini-3.5-flash-lite";

/**
 * Returns true if the photo shows a small/transitional area that can't
 * realistically fit large furniture. Best-effort: on any failure
 * (network, malformed response, etc.) this resolves to false rather than
 * throwing, so a classification hiccup never blocks generation entirely
 * — it just means the small-space override doesn't get auto-triggered by
 * the photo for that one run, same as if the user hadn't typed a matching
 * keyword either.
 */
export async function isSmallTransitionalSpace(imageDataUrl: string): Promise<boolean> {
  try {
    const inline = dataUrlToInline(imageDataUrl);

    const result = await geminiJson<{ isSmallSpace: boolean; reason: string }>({
      model: SPACE_CLASSIFICATION_MODEL,
      systemInstruction:
        "You judge whether a room photo shows a full room with real open floor space suitable for furniture (a living room, bedroom, dining room, office, etc. with actual clear floor area) versus a small or transitional area — a stair landing, staircase, hallway corner, entryway nook, narrow alcove, or similar tight/passage space — that realistically has room only for small decor accents (a vase, small plant, wall art, mirror, sconce, slim console at most), not large furniture like a dresser, sofa, bookshelf, or armchair. Base this purely on the visible floor and wall footprint in the photo, not on any furniture already present.",
      parts: [
        { inlineData: inline },
        {
          text: "Classify this room photo: is it a small/transitional space, or a full room with real open floor area?",
        },
      ],
      schema: {
        type: "object",
        properties: {
          isSmallSpace: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["isSmallSpace", "reason"],
      },
    });

    return result.isSmallSpace;
  } catch {
    return false;
  }
}