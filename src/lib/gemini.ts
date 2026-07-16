// Client-safe re-exports. Actual Gemini calls live in gemini.server.ts.
export const GEMINI_MODELS = {
  chat: "gemini-2.5-flash",
  image: "gemini-2.5-flash-image",
} as const;
