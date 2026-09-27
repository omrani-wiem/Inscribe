import { FeedbackRecord } from '../types';

/**
 * Parse a CSV string and return an array of partial FeedbackRecord objects.
 * Supports: transcription, sentiment, rating, themes, summary, source, tags columns (case-insensitive headers).
 */
export function importFromCSV(csvText: string): Omit<FeedbackRecord, 'id' | 'timestamp'>[] {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (name: string) => headers.indexOf(name);

  return lines.slice(1).map(line => {
    const cells = parseRow(line);
    const get = (name: string) => cells[col(name)] ?? '';
    const transcription = get('transcription') || get('text') || get('feedback') || '';
    if (!transcription) return null;

    const rawSentiment = (get('sentiment') || '').toLowerCase();
    const sentiment: 'positive' | 'neutral' | 'negative' =
      rawSentiment === 'positive' ? 'positive' :
      rawSentiment === 'negative' ? 'negative' : 'neutral';

    const rawRating = parseFloat(get('rating'));
    const rating = isNaN(rawRating) ? null : Math.min(5, Math.max(1, Math.round(rawRating)));

    const themes = (get('themes') || '').split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean);
    const tags = (get('tags') || '').split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean);

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
    reader.readAsText(file);
  });
}
