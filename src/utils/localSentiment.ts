import { pipeline } from '@xenova/transformers';

// Modèle léger (~60 Mo), 3 classes : positive / neutral / negative.
// Téléchargé une seule fois puis mis en cache par le navigateur.
const MODEL_NAME = 'Xenova/twitter-roberta-base-sentiment-latest';

let classifierPromise: Promise<any> | null = null;

export function loadSentimentModel(onProgress?: (pct: number) => void) {
  if (!classifierPromise) {
    classifierPromise = pipeline('sentiment-analysis', MODEL_NAME, {
      progress_callback: (data: any) => {
        if (onProgress && data.status === 'progress' && typeof data.progress === 'number') {
          onProgress(Math.round(data.progress));
        }
      },
    });
  }
  return classifierPromise;
}

export interface LocalSentimentResult {
  label: 'positive' | 'neutral' | 'negative';
  score: number; // confiance du modèle, entre 0 et 1
}

export async function classifySentiment(text: string): Promise<LocalSentimentResult> {
  const classifier = await loadSentimentModel();
  const result = await classifier(text.slice(0, 512)); // le modèle a une limite de longueur
  const top = Array.isArray(result) ? result[0] : result;
  const label = String(top.label).toLowerCase();
  const normalized: 'positive' | 'neutral' | 'negative' = label.includes('pos')
    ? 'positive'
    : label.includes('neg')
    ? 'negative'
    : 'neutral';
  return { label: normalized, score: top.score };
}