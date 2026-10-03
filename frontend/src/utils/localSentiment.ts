import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

// Modèle léger (~60 Mo), 3 classes : positive / neutral / negative.
// Téléchargé une seule fois puis mis en cache par le navigateur.
// Modèle multilingue (EN, FR, DE, ES, IT, NL) qui note de 1 à 5 étoiles.
const MODEL_NAME = 'Xenova/bert-base-multilingual-uncased-sentiment';

// Convertit les probabilités des 5 étoiles en polarité entre -1 (très négatif) et +1 (très positif)
function starsPolarity(scores: Array<{ label: string; score: number }>): number {
  let expected = 0;
  for (const s of scores) {
    const n = parseInt(String(s.label), 10); // "4 stars" -> 4
    if (!Number.isNaN(n)) expected += n * s.score;
  }
  return (expected - 3) / 2;
}

let classifierPromise: Promise<any> | null = null;

export function loadSentimentModel(onProgress?: (pct: number) => void) {
  if (!classifierPromise) {
    classifierPromise = pipeline('sentiment-analysis', MODEL_NAME, {
      progress_callback: (data: any) => {
        if (onProgress && data.status === 'progress' && typeof data.progress === 'number') {
          onProgress(Math.round(data.progress));
        }
      },
    }).catch((err) => {
      classifierPromise = null; // permet de réessayer au prochain appel
      throw err;
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
  const res = await classifier(text.slice(0, 512), { top_k: null });
  const scores: Array<{ label: string; score: number }> = Array.isArray(res[0]) ? res[0] : res;
  const polarity = starsPolarity(scores);
  const label: 'positive' | 'neutral' | 'negative' =
    polarity > 0.25 ? 'positive' : polarity < -0.25 ? 'negative' : 'neutral';
  const top = Math.max(...scores.map(s => s.score));
  return { label, score: top };
}

export interface WordImpact {
  token: string;
  isWord: boolean;
  weight: number; // entre -1 et +1 : >0 pousse vers positif, <0 vers négatif
}

const WORD_RE = /^[\p{L}\p{N}'’-]+$/u; // lettres Unicode : accents et arabe inclus
const MAX_WORDS = 60;

// Mots vides (FR + EN) : jamais analysés, ils ne portent pas de sentiment
const STOP = new Set((
  'le la les l un une des du de d et en à a au aux ce cet cette ces se sa son ses ma mon mes ta ton tes ' +
  'je tu il elle on nous vous ils elles me te lui leur y ne n pas plus que qu qui quoi dont où ou mais donc or ni car ' +
  'si pour par sur sous dans avec sans chez vers entre est sont été être ai as avons avez ont fait peux peut ' +
  'the a an and or but of to in on at for with is are was were be been it its this that these those i you he she we they my your'
).split(/\s+/));

const isStop = (token: string) => {
  const t = token.toLowerCase().replace(/['’].*$/, ''); // "n'y" -> "n", "m'indique" -> "m"
  return STOP.has(t) || t.length < 2;
}; // limite pour garder un temps de calcul raisonnable

async function polarities(classifier: any, texts: string[]): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < texts.length; i += 8) {
    const batch = texts.slice(i, i + 8).map(t => t.slice(0, 512));
    const res = await classifier(batch, { top_k: null });
    const rows = Array.isArray(res[0]) ? res : [res];
    for (const scores of rows) {
      out.push(starsPolarity(scores));
    }
    // Rend la main au navigateur entre deux lots pour que la page reste cliquable
    await new Promise(r => setTimeout(r, 0));
  }
  return out;
}
// Occlusion : on retire chaque mot, on reclasse, et la variation du score
// (positif - négatif) donne l'influence réelle du mot selon le modèle.
export async function explainSentiment(text: string): Promise<WordImpact[]> {
  const classifier = await loadSentimentModel();
  const all: WordImpact[] = text
    .split(/(\s+|[.,!?;:()"«»…])/)
    .filter(Boolean)
    .map(token => ({ token, isWord: WORD_RE.test(token), weight: 0 }));

  // Découpe en segments : une ligne ou une phrase
  const segments: number[][] = [];
  let current: number[] = [];
  all.forEach((t, i) => {
    current.push(i);
    if (/\n/.test(t.token) || /^[.!?…]+$/.test(t.token)) {
      segments.push(current);
      current = [];
    }
  });
  if (current.length) segments.push(current);

  const clean = (idxs: number[], skip: number) =>
    idxs.filter(i => i !== skip).map(i => all[i].token).join('').replace(/\s+/g, ' ').trim();

  // Pour chaque segment : son score seul, puis son score sans chaque mot
  const jobs: string[] = [];
  const plan: Array<{ wordIdx: number; baseJob: number; job: number }> = [];
  let budget = MAX_WORDS;
  for (const seg of segments) {
    const words = seg.filter(i => all[i].isWord && !isStop(all[i].token));
    if (words.length < 2 || budget <= 0) continue;
    const baseJob = jobs.push(clean(seg, -1)) - 1;
    for (const w of words) {
      if (budget <= 0) break;
      budget--;
      plan.push({ wordIdx: w, baseJob, job: jobs.push(clean(seg, w)) - 1 });
    }
  }
  if (jobs.length === 0) return all;

  const p = await polarities(classifier, jobs);
  const SCALE = 0.3; // un mot qui déplace le score de 0,3 ou plus = impact maximal

  const weights = new Map<number, number>();
  for (const { wordIdx, baseJob, job } of plan) {
    weights.set(wordIdx, Math.max(-1, Math.min(1, (p[baseJob] - p[job]) / SCALE)));
  }
  return all.map((t, i) => ({ ...t, weight: weights.get(i) ?? 0 }));
}