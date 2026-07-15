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
