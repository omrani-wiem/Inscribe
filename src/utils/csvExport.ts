import { FeedbackRecord } from '../types';

export function exportToCSV(records: FeedbackRecord[], filename?: string): void {
  const headers = [
    'ID', 'Date', 'Sentiment', 'Rating', 'Confidence',
    'Themes', 'Tags', 'Summary', 'Transcription', 'Source',
    'Language', 'Needs Review', 'Reviewed & Edited'
  ];
  const escape = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = records.map(item => [
    escape(item.id),
    escape(new Date(item.timestamp).toLocaleString()),
    escape(item.sentiment),
    escape(item.rating),
    escape(item.confidence),
    escape((item.themes ?? []).join('; ')),
    escape((item.tags ?? []).join('; ')),
    escape(item.summary),
    escape(item.transcription),
    escape(item.source ?? ''),
    escape(item.language ?? ''),
    escape(item.needsReview ? 'Yes' : 'No'),
    escape(item.reviewedAndEdited ? 'Yes' : 'No'),
  ]);
  const csvContent = [headers.map(escape).join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename ?? 'feedback_export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
