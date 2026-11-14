// Preset options used across the app. Edit these lists to change the choices.

export const STYLE_TAGS = [
  "vintage",
  "streetwear",
  "y2k",
  "preppy",
  "athletic",
  "boho",
  "minimalist",
  "grunge",
] as const;

export const CATEGORIES = [
  "Tops",
  "Bottoms",
  "Dresses",
  "Outerwear",
  "Shoes",
  "Accessories",
  "Other",
] as const;

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "One size"] as const;

export const CONDITIONS = ["New with tags", "Like new", "Good", "Fair"] as const;

export const PHOTO_BUCKET = "item-photos";
export const MAX_PHOTOS = 4;
