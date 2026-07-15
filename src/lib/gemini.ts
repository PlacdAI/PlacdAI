// Client-safe re-exports (types only). Real Gemini calls live in gemini.server.ts.
export const GEMINI_MODELS = {
  chat: "gemini-2.5-flash",
  image: "gemini-2.5-flash-image",
} as const;
