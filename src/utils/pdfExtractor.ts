/**
 * Extracts each page of a PDF file as a separate PNG image File.
 * Loads pdf.js dynamically from CDN (no npm install needed).
 */

const PDFJS_VERSION = '4.9.155';

let pdfLoadingPromise: Promise<any> | null = null;

async function getPdfLib(): Promise<any> {
  // Already loaded — return cached instance
  const existing = (window as any).pdfjsLib;
  if (existing) return existing;

  // Already loading — return the same promise to avoid duplicate <script> tags
  if (pdfLoadingPromise) return pdfLoadingPromise;

  pdfLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (lib) {
        lib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
        resolve(lib);
      } else {
        reject(new Error('pdf.js loaded but pdfjsLib not found on window'));
      }
    };
    script.onerror = () => {
      pdfLoadingPromise = null; // reset so retries can happen
      reject(new Error('Failed to load pdf.js from CDN. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });

  return pdfLoadingPromise;
}

export interface ExtractedPage {
  file: File;
  pageIndex: number;
  totalPages: number;
  originalFileName: string;
}

/**
 * Given a PDF File, load it via pdf.js (CDN) and extract each page
 * as a separate PNG image File at ~150 DPI for OCR quality.
 */
export async function extractPdfPages(pdfFile: File): Promise<ExtractedPage[]> {
  const pdfjsLib = await getPdfLib();

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const baseName = pdfFile.name.replace(/\.pdf$/i, '');
  const results: ExtractedPage[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    // Fill white background (PDFs often have transparent backgrounds)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/png');
    });

    const pageFileName =
      totalPages > 1
        ? `${baseName} - Page ${i}.png`
        : `${baseName}.png`;
    const file = new File([blob], pageFileName, { type: 'image/png' });

    results.push({
      file,
      pageIndex: i,
      totalPages,
      originalFileName: pdfFile.name,
    });
  }

  return results;
}
