/**
 * Shared color utilities for BubbleCanvas and ClusterTree
 * Ensures consistent color palette across components
 */

// Color palette for L2 categories
export const CATEGORY_COLORS: { [key: string]: string } = {
  "l2-1": "#F9F0C7", // Pale Yellow for Software Development Tutorials
  "l2-2": "#BD8BA0", // Muted Rose for Data Science & Analytics
  "l2-3": "#E8A7B9", // Soft Pink for DevOps & Infrastructure
  // Future categories can use: #3F4A59 (Dark Blue/Slate) or similar shades
};

/**
 * Convert hex color to HSL
 */
export function hexToHsl(hex: string): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    const rChar = hex[1];
    const gChar = hex[2];
    const bChar = hex[3];
    if (rChar && gChar && bChar) {
      r = parseInt(rChar + rChar, 16);
      g = parseInt(gChar + gChar, 16);
      b = parseInt(bChar + bChar, 16);
    }
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

/**
 * Convert HSL to hex color
 */
export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate a darker shade by adjusting lightness and saturation
 */
export function getDarkerShade(
  baseColor: string,
  darknessAmount: number = -15
): string {
  const [h, s, l] = hexToHsl(baseColor);
  const newL = Math.min(95, Math.max(5, l + darknessAmount));
  // Slightly reduce saturation for darker shades to avoid muddy colors
  const newS = Math.min(100, Math.max(0, s - 5));
  return hslToHex(h, newS, newL);
}

/**
 * Generate a "glowier" (lighter and more saturated) shade
 */
export function getGlowierShade(
  baseColor: string,
  lightnessBoost: number = 12,
  saturationBoost: number = 10
): string {
  const [h, s, l] = hexToHsl(baseColor);
  const newL = Math.min(95, Math.max(5, l + lightnessBoost));
  const newS = Math.min(100, Math.max(0, s + saturationBoost));
  return hslToHex(h, newS, newL);
}

/**
 * Generate a darker shade for text to ensure legibility
 */
export function getTextColor(baseColor: string): string {
  const [h, s, l] = hexToHsl(baseColor);
  // Make text significantly darker (reduce lightness by 40-50%)
  const textL = Math.max(15, Math.min(35, l - 45)); // Keep between 15-35% lightness
  const textS = Math.min(100, Math.max(20, s - 10)); // Reduce saturation slightly
  return hslToHex(h, textS, textL);
}

/**
 * Generate a slightly darker shade for borders
 */
export function getBorderColor(baseColor: string): string {
  const [h, s, l] = hexToHsl(baseColor);
  const borderL = Math.max(20, Math.min(50, l - 22)); // Keep between 20-50% lightness
  const borderS = Math.min(100, Math.max(25, s - 5)); // Slightly reduce saturation
  return hslToHex(h, borderS, borderL);
}

/**
 * Get shade for a specific depth level
 * L2: base color
 * L1: base minus ~15% lightness, -5% saturation
 * L0: base minus ~25% lightness, -10% saturation
 */
export function getShadeForDepth(
  baseColor: string,
  depth: "l2" | "l1" | "l0"
): string {
  switch (depth) {
    case "l2":
      return baseColor;
    case "l1": {
      const [h, s, l] = hexToHsl(baseColor);
      const newL = Math.min(95, Math.max(5, l - 15));
      const newS = Math.min(100, Math.max(0, s - 5));
      return hslToHex(h, newS, newL);
    }
    case "l0": {
      const [h, s, l] = hexToHsl(baseColor);
      const newL = Math.min(95, Math.max(5, l - 25));
      const newS = Math.min(100, Math.max(0, s - 10));
      return hslToHex(h, newS, newL);
    }
  }
}

/**
 * Get the base color for a cluster node based on its L2 ancestor
 */
export function getBaseColorForNode(node: {
  type: "l2" | "l1" | "l0";
  l2_cluster_id?: number;
  id: string;
}): string {
  if (node.type === "l2") {
    return CATEGORY_COLORS[node.id] || "#D1D5DB";
  }
  // For L1 and L0, we need to find their L2 ancestor
  // Since we don't have the full tree here, we'll use the l2_cluster_id if available
  if (node.l2_cluster_id !== undefined) {
    const l2Id = `l2-${node.l2_cluster_id}`;
    return CATEGORY_COLORS[l2Id] || "#D1D5DB";
  }
  return "#D1D5DB"; // Default gray
}

/**
 * Get the display color for a cluster node (base color adjusted for depth)
 */
export function getColorForNode(node: {
  type: "l2" | "l1" | "l0";
  l2_cluster_id?: number;
  id: string;
}): string {
  const baseColor = getBaseColorForNode(node);
  return getShadeForDepth(baseColor, node.type);
}





