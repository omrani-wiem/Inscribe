import { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { FeedbackRecord, QueueItem, AppSettings } from './types';




const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';

const DEFAULT_SETTINGS: AppSettings = {
  apiProvider: 'ocr',
  groqApiKey: '',
  groqModel: DEFAULT_GROQ_MODEL,
  geminiApiKey: '',
  geminiModel: GEMINI_DEFAULT_MODEL,
  ocrSpaceApiKey: '',
  preprocessForOcr: true,
  mistralApiKey: '',
  defaultDateRange: 'all',
  darkMode: false,
  alertThreshold: 40,
  emailJsConfig: { serviceId: '', templateId: '', publicKey: '', recipientEmail: '' }
};

// Key names for localStorage
const STORAGE_KEY_FEEDBACK = 'feedback_dashboard_items';
const STORAGE_KEY_SETTINGS = 'feedback_dashboard_settings';

export function useFeedbackStore() {
  const [feedbackList, setFeedbackList] = useState<FeedbackRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
    // Toujours la dernière liste, même avant le prochain rendu React
  const listRef = useRef<FeedbackRecord[]>([]);
    // Rafraîchissement : récupère les nouveaux avis reçus par le formulaire (toutes les 30 s)
   useEffect(() => {
    if (!isLoaded) return;
    const t = setInterval(async () => {
      try {
        const remote = await api.listFeedback();
        const local = new Map(listRef.current.map(i => [i.id, i]));
        const pending = (r: FeedbackRecord) => r.sentimentReasoning?.startsWith('Reçu via');
        const changed = remote.filter(r => {
          const l = local.get(r.id);
          return !l || (pending(l) && !pending(r));
        });
        if (changed.length) {
          const ids = new Set(changed.map(c => c.id));
          saveFeedbackList(prev =>
            [...changed, ...prev.filter(p => !ids.has(p.id))]
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
        }
      } catch { /* backend momentanément injoignable */ }
    }, 30000);
    return () => clearInterval(t);
  }, [isLoaded]);


   
  useEffect(() => {
    (async () => {
      try {
        let list = await api.listFeedback();

        // Migration unique : anciens avis du navigateur -> base de données
        const old = localStorage.getItem(STORAGE_KEY_FEEDBACK);
        if (list.length === 0 && old && !localStorage.getItem('feedback_migrated')) {
          const oldItems: FeedbackRecord[] = JSON.parse(old);
          for (const it of oldItems) await api.createFeedback(it);
          localStorage.setItem('feedback_migrated', '1');
          list = await api.listFeedback();
        }
        saveFeedbackList(list);

        let remote = await api.getSettings();
        if (Object.keys(remote).length === 0) {
          const oldS = localStorage.getItem(STORAGE_KEY_SETTINGS);
          if (oldS) {
            remote = JSON.parse(oldS);
            await api.saveSettings({ ...DEFAULT_SETTINGS, ...remote });
            localStorage.removeItem(STORAGE_KEY_SETTINGS);
          }
        }
        setSettings({ ...DEFAULT_SETTINGS, ...remote } as AppSettings);
      } catch (e) {
        console.error('Backend injoignable. Est-il lancé sur le port 8080 ?', e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);
    const saveFeedbackList = (updater: FeedbackRecord[] | ((prev: FeedbackRecord[]) => FeedbackRecord[])) => {
    const next = typeof updater === 'function' ? updater(listRef.current) : updater;
    listRef.current = next;
    setFeedbackList(next);
  };

  const saveSettings = (input: AppSettings) => {
    const newSettings: AppSettings = {
      ...input,
      geminiApiKey: (input.geminiApiKey ?? '').trim(),
      mistralApiKey: (input.mistralApiKey ?? '').trim(),
      groqApiKey: (input.groqApiKey ?? '').trim(),
      ocrSpaceApiKey: (input.ocrSpaceApiKey ?? '').trim(),
    };
    setSettings(newSettings);
        api.saveSettings(newSettings).catch(e => console.error('Impossible de sauvegarder les réglages', e));
  };

   const clearAllData = () => {
    const ids = listRef.current.map(i => i.id);
    saveFeedbackList([]);
    Promise.all(ids.map(id => api.deleteFeedback(id))).catch(console.error);
  };

  // Sample test data — only loaded on explicit user action
  const SAMPLE_TEST_DATA: FeedbackRecord[] = [
    {
      id: 'DEMO-001',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      transcription: "The staff was super friendly but the wait time to get our coffee was almost 25 minutes! The croissant was cold too.",
      sentiment: "negative",
      sentimentReasoning: "Long 25-minute wait time for coffee and cold croissant quality outweigh the positive mention of friendly staff.",
      themes: ["staff friendliness", "wait time", "food quality"],
      rating: 2,
      summary: "Friendly staff but long coffee wait time and cold pastry.",
      confidence: "high",
      needsReview: false,
      source: "Sample Data",
      respondent: { name: "Alice J.", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Alice" }
    },
    {
      id: 'DEMO-002',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      transcription: "Absolutely love the new layout. Very cozy and neat. Excellent service from the cashier!",
      sentiment: "positive",
      sentimentReasoning: "Explicit praise for the cozy new layout and excellent cashier service clearly indicates satisfaction across ambiance and service.",
      themes: ["ambiance", "customer service"],
      rating: 5,
      summary: "Loves new cozy layout and praises excellent cashier service.",
      confidence: "high",
      needsReview: false,
      source: "Sample Data",
      respondent: { name: "Robert C.", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Robert" }
    },
    {
      id: 'DEMO-003',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      transcription: "The pricing seems to have gone up again. 8 dollars for a slice of cake is too much. Service was okay.",
      sentiment: "neutral",
      sentimentReasoning: "Mixed feedback — negative view on pricing (too expensive) balanced by acceptable service, resulting in a neutral overall rating.",
      themes: ["pricing", "value", "customer service"],
      rating: 3,
      summary: "Feels pricing is high at $8 for cake; service was acceptable.",
      confidence: "medium",
      needsReview: false,
      source: "Sample Data",
      respondent: { name: "Maria G.", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Maria" }
    },
    {
      id: 'DEMO-004',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      transcription: "I can't read what this says, it looks like scribble... something about wifi?",
      sentiment: "neutral",
      sentimentReasoning: "Text is largely illegible — only a vague mention of wifi can be inferred, making sentiment impossible to determine.",
      themes: ["wifi"],
      rating: null,
      summary: "Illegible handwriting mentioning something related to wifi.",
      confidence: "low",
      needsReview: true,
      source: "Sample Data",
      respondent: { name: "Anonymous", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Anon" }
    },
    {
      id: 'DEMO-005',
      timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      transcription: "Clean tables, nice background music, and fast wifi! Will come back next week.",
      sentiment: "positive",
      sentimentReasoning: "Multiple positive mentions — clean tables, nice background music, and fast wifi — plus intent to return confirms strong satisfaction.",
      themes: ["cleanliness", "ambiance", "wifi"],
      rating: 5,
      summary: "Praises clean tables, background music, and fast wifi.",
      confidence: "high",
      needsReview: false,
      source: "Sample Data",
      respondent: { name: "David K.", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=David" }
    },
    {
      id: 'DEMO-006',
      timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      transcription: "Bathroom was dirty. Please fix it. Also the mocha was too sweet.",
      sentiment: "negative",
      sentimentReasoning: "Direct complaint about dirty bathroom and criticism of overly sweet mocha — both are clear negative indicators pointing to dissatisfaction.",
      themes: ["cleanliness", "food quality"],
      rating: 2,
      summary: "Complains of dirty bathroom and overly sweet mocha.",
      confidence: "high",
      needsReview: false,
      source: "Sample Data",
      respondent: { name: "Sarah C.", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Sarah" }
    },
    {
      id: 'DEMO-007',
      timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      transcription: "Perfect spot for remote work. Great wifi, plenty of power outlets, and the cold brew is fantastic.",
      sentiment: "positive",
      sentimentReasoning: "Described as a 'perfect spot' with great wifi, plenty of power outlets, and fantastic cold brew — all strongly positive language.",
      themes: ["ambiance", "wifi", "food quality"],
      rating: 5,
      summary: "Recommends for remote work with great amenities and excellent cold brew.",
      confidence: "high",
      needsReview: false,
      source: "Sample Data",
      respondent: { name: "Jamie L.", avatarUrl: "https://api.dicebear.com/7.x/adventurer/svg?seed=Jamie" }
    }
  ];

   const loadSampleData = () => {
    const oldIds = listRef.current.map(i => i.id);
    saveFeedbackList(SAMPLE_TEST_DATA);
    Promise.all(oldIds.map(id => api.deleteFeedback(id)))
      .then(() => Promise.all(SAMPLE_TEST_DATA.map(r => api.createFeedback(r))))
      .catch(console.error);
  };

     const addFeedback = (item: Omit<FeedbackRecord, 'id' | 'timestamp'>): string => {
    const id = `FB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newRecord: FeedbackRecord = { ...item, id, timestamp: new Date().toISOString() };
    saveFeedbackList(prev => [newRecord, ...prev]);
    api.createFeedback(newRecord).catch(e => console.error('Sauvegarde de l\'avis échouée', e));
    return id;
  };

  const updateFeedback = (id: string, updatedFields: Partial<FeedbackRecord>) => {
    saveFeedbackList(prev => prev.map(item => (item.id === id ? { ...item, ...updatedFields } : item)));
    const updated = listRef.current.find(i => i.id === id);
    if (updated) api.updateFeedback(updated).catch(e => console.error('Mise à jour échouée', e));
  };

  const deleteFeedback = (id: string) => {
    saveFeedbackList(prev => prev.filter(item => item.id !== id));
    api.deleteFeedback(id).catch(console.error);
  };

  const deleteMultipleFeedback = (ids: string[]) => {
    const idSet = new Set(ids);
    saveFeedbackList(prev => prev.filter(item => !idSet.has(item.id)));
    Promise.all(ids.map(id => api.deleteFeedback(id))).catch(console.error);
  };

  // Queue Management
  const addToQueue = (files: File[]) => {
    const newItems: QueueItem[] = files.map(file => ({
      id: `Q-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      fileSize: file.size,
      objectUrl: URL.createObjectURL(file),
      status: 'queued',
      progress: 0
    }));
    setQueue(prev => [...prev, ...newItems]);
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.objectUrl);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const clearQueue = () => {
    queue.forEach(item => URL.revokeObjectURL(item.objectUrl));
    setQueue([]);
  };

  const retryItem = (id: string) =>
  setQueue(prev => prev.map(q =>
    q.id === id ? { ...q, status: 'queued', progress: 0, error: undefined, note: undefined } : q
  ));

  // Run the batch analysis
  const analyzeBatch = async () => {
    if (isProcessing || queue.length === 0) return;
    setIsProcessing(true);

    const itemsToProcess = queue.filter(item => item.status === 'queued');
    
    // Update statuses to reading
    setQueue(prev => prev.map(q => 
      (q.status === 'queued') ? { ...q, status: 'reading', progress: 10 } : q
    ));

    for (const item of itemsToProcess) {
      try {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: 30 } : q));
       

        // Require a real API key — no mock fallback
        const analysisResult = await api.analyzeImage(
          await imageForUpload(item.objectUrl, settings.apiProvider === 'ocr' && (settings.preprocessForOcr ?? true))
        );
        

        // Compress and save the original scanned image to FeedbackRecord
        let scannedImage: string | undefined;
        try {
          scannedImage = await compressImage(item.objectUrl);
        } catch (e) {
          console.error('Failed to compress image:', e);
        }

        const finalResult = {
          ...analysisResult,
          scannedImage
        };

        const feedbackId = addFeedback(finalResult);

        setQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, 
          status: 'done', 
          progress: 100, 
          transcriptionPreview: analysisResult.transcription.substring(0, 60) + '...',
          result: finalResult,
          feedbackId
        } : q));

       
      } catch (err: any) {
        console.error('Analysis failed for file: ' + item.fileName, err);
        setQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, 
          status: 'failed', 
          progress: 0, 
          error: err.message || 'Unknown processing error'
        } : q));
      }
    }

    setIsProcessing(false);
  };

  // ── Tag management ──────────────────────────────────────────────────────────
    const addTag = (id: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    const existing = listRef.current.find(i => i.id === id)?.tags ?? [];
    if (!existing.includes(trimmed)) updateFeedback(id, { tags: [...existing, trimmed] });
  };

  const removeTag = (id: string, tag: string) => {
    const existing = listRef.current.find(i => i.id === id)?.tags ?? [];
    updateFeedback(id, { tags: existing.filter(t => t !== tag) });
  };

  // ── Re-analyze an existing record ───────────────────────────────────────────
    const reAnalyzeFeedback = async (id: string) => {
    const item = listRef.current.find(f => f.id === id);
    if (!item) return;
    let result: Omit<FeedbackRecord, 'id' | 'timestamp'>;
    try {
      result = await api.analyzeText(item.transcription);
    } catch (e) {
      console.warn('IA serveur indisponible, modèle local utilisé', e);
      result = await analyzeTextLocally(item.transcription);
    }
    updateFeedback(id, {
      ...result,
      transcription: item.transcription,
      rating: item.rating ?? result.rating,
      source: 'Re-analyzed',
      reviewedAndEdited: false,
    });
  };
  // ── Generate auto-reply draft ────────────────────────────────────────────────
     const generateAutoReply = async (id: string): Promise<string> => {
    const item = listRef.current.find(f => f.id === id);
    if (!item) throw new Error('Feedback introuvable.');
    const { reply } = await api.reply(item.transcription, item.sentiment);
    updateFeedback(id, { autoReplyDraft: reply });
    return reply;
  };


  // ── Duplicate detection (Jaccard similarity on word tokens) ─────────────────
  const detectDuplicates = () => {
    const tokenize = (text: string) =>
      new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 3));

    const jaccardSimilarity = (a: Set<string>, b: Set<string>) => {
      const intersection = new Set([...a].filter(x => b.has(x)));
      const union = new Set([...a, ...b]);
      return union.size === 0 ? 0 : intersection.size / union.size;
    };

    const THRESHOLD = 0.75;
    const seen: Record<string, string> = {}; // id -> duplicate-of id

    const list = [...feedbackList];
    for (let i = 0; i < list.length; i++) {
      if (seen[list[i].id]) continue;
      const tokensI = tokenize(list[i].transcription);
      for (let j = i + 1; j < list.length; j++) {
        if (seen[list[j].id]) continue;
        const tokensJ = tokenize(list[j].transcription);
        if (jaccardSimilarity(tokensI, tokensJ) >= THRESHOLD) {
          seen[list[j].id] = list[i].id;
        }
      }
    }

    // Apply to store
    const updated = feedbackList.map(f => ({
      ...f,
      duplicateOf: seen[f.id] ?? undefined,
    }));
    saveFeedbackList(updated);
  };

  // Auto-analyze: when items are added to the queue, start analysis automatically
  useEffect(() => {
    const hasQueuedItems = queue.some(item => item.status === 'queued');
    if (hasQueuedItems && !isProcessing) {
      analyzeBatch();
    }
  }, [queue, isProcessing, analyzeBatch]);

  return {
    feedbackList,
    settings,
    queue,
    isProcessing,
    saveSettings,
    clearAllData,
    loadSampleData,
    addFeedback,
    updateFeedback,
    deleteFeedback,
    deleteMultipleFeedback,
    addToQueue,
    removeFromQueue,
    clearQueue,
    retryItem,
    analyzeBatch,
    addTag,
    removeTag,
    reAnalyzeFeedback,
    generateAutoReply,
    detectDuplicates,
  };
}


// Compress image from objectUrl to base64 JPEG data URI to reduce storage usage
async function compressImage(objectUrl: string, maxWidth: number = 800, quality: number = 0.7): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.src = objectUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (err) => reject(err);
  });
}

// Image réduite (les photos de téléphone sont lourdes), avec amélioration facultative pour OCR.space
async function imageForUpload(objectUrl: string, preprocess: boolean): Promise<string> {
  let dataUri = await compressImage(objectUrl, 1600, 0.85);
  if (preprocess) {
    try {
      const { preprocessForOCR } = await import('./utils/imagePreprocess');
      dataUri = await preprocessForOCR(dataUri, { binarize: true });
    } catch (e) {
      console.warn("Amélioration de l'image impossible, image d'origine envoyée", e);
    }
  }
  return dataUri;
}

// Secours hors ligne : sentiment par modèle local, sans thèmes ni clés
async function analyzeTextLocally(transcription: string): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>> {
  const lower = transcription.toLowerCase();
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  let reasoning = 'Modèle local indisponible : sentiment neutre par défaut.';
  let score = 0;
  try {
    const { classifySentiment } = await import('./utils/localSentiment');
    const r = await classifySentiment(transcription);
    sentiment = r.label;
    score = r.score;
    reasoning = `Modèle local : "${sentiment}" (${Math.round(r.score * 100)} % de confiance). Serveur IA indisponible, utilisez Re-analyze plus tard.`;
  } catch (e) {
    console.error('Modèle local en échec', e);
  }

  let rating: number | null = null;
  const m = lower.match(/(\d)\s*(?:\/\s*5|stars?|out of 5|etoiles?)/);
  if (m) { const r = parseInt(m[1], 10); if (r >= 1 && r <= 5) rating = r; }

  const words = lower.match(/[a-zà-ÿ']+/g) ?? [];
  const confidence: 'high' | 'medium' | 'low' =
    score >= 0.85 && words.length >= 6 ? 'high' : score >= 0.6 ? 'medium' : 'low';
  const first = transcription.split(/[.!?]/)[0].trim();

  return {
    transcription,
    sentiment,
    sentimentReasoning: reasoning,
    themes: [],
    rating,
    summary: first.length > 100 ? first.substring(0, 100) + '…' : first || transcription.substring(0, 80),
    confidence,
    needsReview: confidence === 'low',
    source: 'Modèle local',
  };
}
