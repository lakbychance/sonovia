/**
 * Get a color based on audio energy levels
 */
export const getColorFromEnergy = (
  bassEnergy: number,
  midEnergy: number,
  highEnergy: number,
  colorMode: 'dynamic' | 'monochrome' | 'spectrum',
  baseColor: string = '#4a3670'
): string => {
  switch (colorMode) {
    case 'dynamic': {
      const totalEnergy = bassEnergy + midEnergy + highEnergy;

      const mediumColors = [
        { r: 60, g: 60, b: 90 },     // 0 - Very low: muted deep blue
        { r: 90, g: 80, b: 120 },    // 1 - Dark slate
        { r: 106, g: 90, b: 205 },   // 2 - Slate Blue
        { r: 147, g: 112, b: 219 },  // 3 - Medium Purple
        { r: 135, g: 159, b: 237 },  // 4 - Periwinkle
        { r: 72, g: 209, b: 204 },   // 5 - Turquoise
        { r: 102, g: 205, b: 170 },  // 6 - Aqua
        { r: 240, g: 230, b: 140 },  // 7 - Khaki
        { r: 219, g: 112, b: 147 },  // 8 - Rose
        { r: 240, g: 128, b: 128 },  // 9 - Coral (high energy peak)
      ];

      // Clamp and normalize totalEnergy between 0 and 1
      const clampedEnergy = Math.max(0, Math.min(1, totalEnergy));
      const level = clampedEnergy * 9; // Scale to 0–9
      const lowerIndex = Math.floor(level);
      const upperIndex = Math.min(9, lowerIndex + 1);
      const t = level - lowerIndex; // Interpolation factor

      const c1 = mediumColors[lowerIndex];
      const c2 = mediumColors[upperIndex];

      // Interpolate color
      const r = Math.floor(c1.r + (c2.r - c1.r) * t);
      const g = Math.floor(c1.g + (c2.g - c1.g) * t);
      const b = Math.floor(c1.b + (c2.b - c1.b) * t);

      // Optional pulse effect based on energy
      const pulseAmount = Math.sin(Date.now() * 0.005) * 0.1 * clampedEnergy;
      const finalColor = {
        r: Math.min(255, Math.max(0, Math.floor(r * (1 + pulseAmount * 0.5)))),
        g: Math.min(255, Math.max(0, Math.floor(g * (1 + pulseAmount * 0.5)))),
        b: Math.min(255, Math.max(0, Math.floor(b * (1 + pulseAmount * 0.5))))
      };

      return `rgb(${finalColor.r}, ${finalColor.g}, ${finalColor.b})`;
    }



    case 'monochrome':
      const hslColor = hexToHSL(baseColor);
      const averageEnergy = (bassEnergy + midEnergy + highEnergy) / 3;
      const adjustedLightness = Math.min(70, Math.max(20, hslColor.l + averageEnergy * 30));
      return `hsl(${hslColor.h}, ${hslColor.s}%, ${adjustedLightness}%)`;

    case 'spectrum':
      // Rainbow colors based on energy distribution
      const time = Date.now() * 0.001; // Current time in seconds
      const totalEnergySpectrum = (bassEnergy + midEnergy + highEnergy) / 3;

      // Base hue shifts over time and with energy
      const baseHue = (time * 30) % 360;
      const energyHueShift = totalEnergySpectrum * 60;
      const finalHue = (baseHue + energyHueShift) % 360;

      // Saturation increases with energy
      const saturation = 70 + totalEnergySpectrum * 30;

      // Lightness varies with beat intensity
      const lightness = 45 + totalEnergySpectrum * 25;

      return `hsl(${finalHue}, ${saturation}%, ${lightness}%)`;

    default:
      return '#4a3670';
  }
};

/**
 * Convert hex color to HSL
 */
export const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
  // Remove the # if present
  hex = hex.replace(/^#/, '');

  // Parse the hex values
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
  } else {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
  }

  // Find max and min values
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
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

  // Convert to degrees, percentages
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return { h, s, l };
};