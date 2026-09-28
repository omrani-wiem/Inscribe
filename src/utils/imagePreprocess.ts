/**
 * Prétraitement d'image côté navigateur (Canvas API), pensé pour les moteurs
 * OCR classiques comme OCR.space Engine 2. Volontairement PAS utilisé avant
 * Gemini/Mistral : ces modèles vision sont déjà robustes au bruit/contraste,
 * et un traitement agressif peut effacer des traits fins d'écriture manuscrite.
 *
 * Pipeline : niveaux de gris -> étirement de contraste (histogram stretching)
 * -> binarisation adaptative simple (seuillage local par bloc).
 */

async function loadImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUri;
  });
}

/** Étire l'histogramme des niveaux de gris entre 0 et 255 (améliore le contraste faible) */
function stretchContrast(gray: Uint8ClampedArray): void {
  let min = 255, max = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  const range = max - min;
  if (range < 10) return; // image déjà presque uniforme, ne rien faire
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(((gray[i] - min) / range) * 255);
  }
}

/**
 * Seuillage adaptatif simple : pour chaque bloc de l'image, calcule une
 * moyenne locale et binarise par rapport à elle. Gère mieux l'éclairage
 * inégal (ombres, papier jauni) qu'un seuil global unique.
 */
function adaptiveThreshold(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize = 25,
  c = 10
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  const half = Math.floor(blockSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      const x0 = Math.max(0, x - half), x1 = Math.min(width - 1, x + half);
      const y0 = Math.max(0, y - half), y1 = Math.min(height - 1, y + half);
      // Échantillonne le voisinage tous les 3px pour rester rapide sur mobile
      for (let yy = y0; yy <= y1; yy += 3) {
        for (let xx = x0; xx <= x1; xx += 3) {
          sum += gray[yy * width + xx];
          count++;
        }
      }
      const localMean = sum / count;
      const idx = y * width + x;
      out[idx] = gray[idx] < localMean - c ? 0 : 255;
    }
  }
  return out;
}

export interface PreprocessOptions {
  binarize?: boolean; // false = garder en niveaux de gris contrastés, sans noir/blanc pur
  maxDimension?: number; // limite la taille pour rester rapide
}

/**
 * Prend une image (data URI), applique le pipeline, renvoie une nouvelle
 * data URI JPEG prête à être envoyée à un moteur OCR.
 */
export async function preprocessForOCR(
  dataUri: string,
  options: PreprocessOptions = {}
): Promise<string> {
  const { binarize = true, maxDimension = 1600 } = options;

  const img = await loadImage(dataUri);
  let { width, height } = img;

  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUri; // pas de canvas disponible, on renvoie l'original tel quel

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  // Niveaux de gris (luminance perceptuelle)
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  stretchContrast(gray);

  const final = binarize ? adaptiveThreshold(gray, width, height) : gray;

  for (let p = 0, i = 0; p < final.length; p++, i += 4) {
    data[i] = data[i + 1] = data[i + 2] = final[p];
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}