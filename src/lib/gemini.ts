// Client-safe re-exports. Actual Gemini calls live in gemini.server.ts.
export const GEMINI_MODELS = {
  chat: "gemini-3.1-flash-lite",
  image: "gemini-3.1-flash-image",
} as const;
