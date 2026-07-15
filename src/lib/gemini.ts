// Client-safe re-exports. Actual gateway calls live in gemini.server.ts.
export const GEMINI_MODELS = {
  chat: "google/gemini-2.5-flash",
  image: "google/gemini-3-pro-image",
} as const;
