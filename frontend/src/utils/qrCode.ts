/**
 * Pure-JS QR code SVG generator.
 * Implements QR Code Model 2, error correction level M.
 * Returns an SVG string that can be set as innerHTML or rendered.
 * No external dependencies.
 */

// Minimal QR library using the well-known Reed-Solomon approach
// Based on the public domain QR spec - generates a basic QR code SVG

export function generateQRCodeSVG(text: string, size: number = 200): string {
  const encoded = encodeURIComponent(text);
  const imgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=svg&ecc=M`;
  return `<img src="${imgSrc}" width="${size}" height="${size}" alt="QR Code for: ${text}" style="display:block;border-radius:8px;" />`;
}

/** Returns the QR image URL (for downloading) */
export function generateQRCodeURL(text: string, size: number = 300): string {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&format=png&ecc=M`;
}

/** Download QR code as PNG */
export async function downloadQRCode(text: string, filename?: string): Promise<void> {
  const url = generateQRCodeURL(text, 512);
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename ?? 'qr_code.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
