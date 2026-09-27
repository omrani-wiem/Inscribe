import { FeedbackRecord, EmailJsConfig } from '../types';

/**
 * Send a weekly digest email via EmailJS.
 * Requires a free EmailJS account and a configured email template.
 * Template variables: {{to_email}}, {{positive_count}}, {{neutral_count}},
 *   {{negative_count}}, {{total_count}}, {{negative_pct}}, {{top_themes}}, {{date_range}}
 */
export async function sendDigestEmail(
  config: EmailJsConfig,
  records: FeedbackRecord[]
): Promise<void> {
  if (!config.serviceId || !config.templateId || !config.publicKey) {
    throw new Error('EmailJS not configured. Add Service ID, Template ID, and Public Key in Settings.');
  }

  const positive = records.filter(r => r.sentiment === 'positive').length;
  const neutral = records.filter(r => r.sentiment === 'neutral').length;
  const negative = records.filter(r => r.sentiment === 'negative').length;
  const total = records.length;
  const negativePct = total > 0 ? Math.round((negative / total) * 100) : 0;

  // Top 5 themes
  const themeCounts: Record<string, number> = {};
  records.forEach(r => r.themes.forEach(t => { themeCounts[t] = (themeCounts[t] ?? 0) + 1; }));
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme, count]) => `${theme} (${count})`)
    .join(', ');

  const templateParams = {
    to_email: config.recipientEmail,
    positive_count: positive,
    neutral_count: neutral,
    negative_count: negative,
    total_count: total,
    negative_pct: negativePct,
    top_themes: topThemes || 'N/A',
    date_range: `Last 7 days (as of ${new Date().toLocaleDateString()})`,
  };

  // Dynamically load EmailJS SDK from CDN (no npm install needed)
  await loadEmailJS();
  const emailjs = (window as any).emailjs;
  if (!emailjs) throw new Error('Failed to load EmailJS SDK.');

  emailjs.init({ publicKey: config.publicKey });
  const result = await emailjs.send(config.serviceId, config.templateId, templateParams);
  if (result.status !== 200) throw new Error(`EmailJS send failed: ${result.text}`);
}

async function loadEmailJS(): Promise<void> {
  if ((window as any).emailjs) return;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load EmailJS SDK from CDN'));
    document.head.appendChild(script);
  });
}
