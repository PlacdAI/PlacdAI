export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  category: string;
  style: string;
  imageUrl: string;
  productUrl: string;
  description: string;
  // Set by /api/swap-product after it cross-checks a fresh detection pass
  // against this product's name/category. `true` = confirmed visible in
  // the final image, `false` = placed but couldn't be confirmed after a
  // retry, `undefined` = not run through verification (e.g. pick-products
  // results before any swap has happened yet).
  verified?: boolean;
}

export const STYLES = [
  "Mid-Century Modern",
  "Minimalist",
  "Scandinavian",
  "Industrial",
  "Bohemian",
  "Japandi",
] as const;

export type Style = (typeof STYLES)[number];