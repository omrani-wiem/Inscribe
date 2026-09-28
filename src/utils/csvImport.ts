import { FeedbackRecord } from '../types';

/**
 * Parse un CSV complet (et non ligne par ligne) : gère les retours à la ligne
 * dans les champs entre guillemets, le BOM d'Excel et le séparateur ";" (Excel FR).
 */
function parseCSV(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xFEFF ? input.slice(1) : input;
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cur); cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else {
      cur += ch;
    }
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }

  return rows.filter(r => r.some(c => c.trim() !== ''));
}

// Retire l'apostrophe ajoutée à l'export pour neutraliser les formules (='...', +'...')
const clean = (s: string) => s.trim().replace(/^'(?=[=+\-@])/, '');

/**
 * Parse a CSV string and return an array of partial FeedbackRecord objects.
 * Supports: transcription, sentiment, rating, themes, summary, source, tags columns (case-insensitive headers).
 */
export function importFromCSV(csvText: string): Omit<FeedbackRecord, 'id' | 'timestamp'>[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (name: string) => headers.indexOf(name);

  return rows.slice(1).map(cells => {
    const get = (name: string) => clean(cells[col(name)] ?? '');
    const transcription = get('transcription') || get('text') || get('feedback') || '';
    if (!transcription) return null;

    const rawSentiment = get('sentiment').toLowerCase();
    const sentiment: 'positive' | 'neutral' | 'negative' =
      rawSentiment === 'positive' ? 'positive' :
      rawSentiment === 'negative' ? 'negative' : 'neutral';

    const rawRating = parseFloat(get('rating'));
    const rating = isNaN(rawRating) ? null : Math.min(5, Math.max(1, Math.round(rawRating)));

    const themes = get('themes').split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean);
    const tags = get('tags').split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean);

    return {
      transcription,
      sentiment,
      themes,
      rating,
      summary: get('summary') || transcription.substring(0, 100),
      confidence: 'medium' as const,
      sentimentReasoning: 'Imported from CSV',
      needsReview: false,
      source: get('source') || 'CSV Import',
      tags: tags.length > 0 ? tags : undefined,
      language: get('language') || undefined,
    };
  }).filter(Boolean) as Omit<FeedbackRecord, 'id' | 'timestamp'>[];
}

/** Read a File object and parse it as CSV */
export async function importFromCSVFile(file: File): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(importFromCSV(e.target?.result as string));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}