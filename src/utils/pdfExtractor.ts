/**
 * Extracts each page of a PDF file as a separate PNG image File.
 * Uses the pdfjs-dist npm package (bundled by Vite, no CDN needed).
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ExtractedPage {
  file: File;
  pageIndex: number;
  totalPages: number;
  originalFileName: string;
}

/**
 * Given a PDF File, load it via pdf.js and extract each page
 * as a separate PNG image File at ~150 DPI for OCR quality.
 */
export async function extractPdfPages(pdfFile: File): Promise<ExtractedPage[]> {
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

    const pageFileName = totalPages > 1 ? `${baseName} - Page ${i}.png` : `${baseName}.png`;
    const file = new File([blob], pageFileName, { type: 'image/png' });

    results.push({ file, pageIndex: i, totalPages, originalFileName: pdfFile.name });
  }

  return results;
}