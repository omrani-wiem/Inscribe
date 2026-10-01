import { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { FeedbackRecord, QueueItem, AppSettings } from './types';

let onRetry: ((msg: string) => void) | null = null;


async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  const TIMEOUT_MS = 60000; // une requête ne peut plus rester bloquée
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (networkErr) {
      clearTimeout(timer);
      if (attempt === maxRetries) throw networkErr;
      console.warn(`Réseau/timeout, tentative ${attempt + 1}/${maxRetries}`, networkErr);
      onRetry?.(`Connexion interrompue, nouvel essai ${attempt + 1}/${maxRetries}…`);
      await new Promise(r => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    clearTimeout(timer);
    const isRetryable = response.status === 429 || response.status >= 500;
    if (response.ok || !isRetryable || attempt === maxRetries) {
      return response;
    }
    onRetry?.(`Service surchargé (HTTP ${response.status}), nouvel essai ${attempt + 1}/${maxRetries}…`);
    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = retryAfter > 0 ? Math.min(retryAfter * 1000, 60000) : 2000 * 2 ** attempt;
    console.warn(`HTTP ${response.status} sur ${new URL(url).host}, tentative ${attempt + 1}/${maxRetries}, attente ${waitMs} ms`);
    await new Promise(r => setTimeout(r, waitMs));
  }
  throw new Error('unreachable');
}

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
const STORAGE_KEY_VERSION = 'feedback_dashboard_version';
const CURRENT_VERSION = 3; // bump this to trigger a data reset on next load

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
        const known = new Set(listRef.current.map(i => i.id));
        const fresh = remote.filter(r => !known.has(r.id));
        if (fresh.length) saveFeedbackList(prev => [...fresh, ...prev]);
      } catch { /* backend momentanément injoignable */ }
    }, 30000);
    return () => clearInterval(t);
  }, [isLoaded]);

  // Analyse automatique des avis du formulaire public (encore "non analysés")
  const analyzingRef = useRef(false);
  useEffect(() => {
    if (!isLoaded || analyzingRef.current) return;
    const pending = feedbackList.filter(
      f => f.source === 'QR Form' && f.sentimentReasoning?.startsWith('Reçu via le formulaire public')
    );
    if (pending.length === 0) return;
    analyzingRef.current = true;
    (async () => {
      for (const item of pending) {
        try {
          const res = await analyzeTextLocally(item.transcription, llmKeysOf(settings));
          updateFeedback(item.id, {
            ...res,
            transcription: item.transcription,
            rating: item.rating ?? res.rating,   // garde la note donnée par le client
            source: 'QR Form',
            respondent: item.respondent,
          });
        } catch (e) {
          console.error('Analyse auto échouée pour', item.id, e);
        }
      }
      analyzingRef.current = false;
    })();
  }, [isLoaded, feedbackList, settings]);
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
    setFeedbackList(prev => (typeof updater === 'function' ? updater(prev) : updater));
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
        onRetry = (msg: string) =>
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, note: msg } : q));

        // Require a real API key — no mock fallback
        let analysisResult;
        if (settings.apiProvider === 'gemini') {
          if (!settings.geminiApiKey) {
            throw new Error('No Gemini API key configured. Go to Settings to add your key.');
          }
          analysisResult = await callGeminiVisionAPI(item.objectUrl, settings.geminiApiKey, settings.geminiModel);
        } else if (settings.apiProvider === 'ocr') {
          if (!settings.ocrSpaceApiKey) {
            throw new Error('No OCR.space API key configured. Go to Settings to add your key.');
          }
          analysisResult = await callOCRSpaceAPI(item.objectUrl, settings.ocrSpaceApiKey, settings.preprocessForOcr ?? true, llmKeysOf(settings));
        } else if (settings.apiProvider === 'mistral') {
          if (!settings.mistralApiKey) {
            throw new Error('No Mistral API key configured. Go to Settings to add your key.');
          }
          analysisResult = await callMistralOCRAPI(item.objectUrl, settings.mistralApiKey);
        } else {
           throw new Error(
            'Groq n\'a plus de modèle vision disponible (llama-4-scout retiré le 17/07/2026). ' +
            'Choisis Gemini, Mistral ou OCR.space dans Settings pour lire des images.'
          );
        }
        

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

    onRetry = null;
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
    const item = feedbackList.find(f => f.id === id);
    if (!item) return;

    // We re-analyze only from transcription (text-only). Use LLM if available.
    const textPrompt = buildTextOnlySentimentPrompt(item.transcription);

    try {
      let result: Partial<FeedbackRecord> | null = null;

      if (settings.apiProvider === 'gemini' && settings.geminiApiKey) {
        result = await callGeminiTextAPI(textPrompt, settings.geminiApiKey, settings.geminiModel);
      } else if (settings.apiProvider === 'groq' && settings.groqApiKey) {
        result = await callGroqTextAPI(textPrompt, settings.groqApiKey, settings.groqModel);
      } else if (settings.apiProvider === 'mistral' && settings.mistralApiKey) {
        // Use the same Mistral Chat API for text-only re-analysis
        const mistralResult = await callMistralChatForAnalysis(item.transcription, settings.mistralApiKey);
        result = {
          sentiment: mistralResult.sentiment,
          sentimentReasoning: mistralResult.sentimentReasoning,
          themes: mistralResult.themes,
          rating: mistralResult.rating,
          summary: mistralResult.summary,
          confidence: mistralResult.confidence,
          transcription: mistralResult.transcription,
          needsReview: mistralResult.needsReview,
          source: 'Mistral AI (Re-analyzed)',
        };
      } else {
        // Fall back to local ML analysis
        result = await analyzeTextLocally(item.transcription, llmKeysOf(settings));
      }

      if (result) {
        let keywords = (result as any).keywords;
        let themes = result.themes;
        if (!keywords) {
          // Chemins LLM : on demande thèmes + mots-clés dans un appel dédié
          const ins = await extractInsightsAuto(item.transcription, llmKeysOf(settings));
          keywords = ins.keywords;
          if (ins.themes.length) themes = ins.themes;
          if (ins.error) console.warn('Thèmes/mots-clés indisponibles :', ins.error);
        }
        updateFeedback(id, {
          ...result,
          transcription: item.transcription,
          themes,
          keywords,
          source: result.source ?? 'Re-analyzed',
          reviewedAndEdited: false,
          needsReview: (result as any).confidence === 'low',
        });
      }
    } catch (err: any) {
      console.error('Re-analyze failed for', id, err);
      throw err; // l'interface affiche maintenant l'erreur
    }
  };

  // ── Generate auto-reply draft ────────────────────────────────────────────────
    const generateAutoReply = async (id: string): Promise<string> => {
    const item = feedbackList.find(f => f.id === id);
    if (!item) throw new Error('Feedback introuvable.');

    const prompt = `You are a customer service manager. Write a short, empathetic, professional response to the following customer feedback. Address the key points directly without generic filler. Keep it under 3 sentences. Reply in the SAME language as the customer feedback.

Customer feedback: "${item.transcription}"
Overall sentiment: ${item.sentiment}

Reply directly to the customer. Do not add subject lines or signatures. Output ONLY the reply text.`;

    // On utilise toute clé texte disponible, même si le provider choisi est OCR.space.
    const candidates: Array<{ name: string; run: () => Promise<string> }> = [];
    if (settings.geminiApiKey) {
      candidates.push({ name: 'Gemini', run: () => callGeminiTextAPIRaw(prompt, settings.geminiApiKey, settings.geminiModel) });
    }
    if (settings.mistralApiKey) {
      candidates.push({ name: 'Mistral', run: () => callMistralTextAPIRaw(prompt, settings.mistralApiKey) });
    }
    if (settings.groqApiKey) {
      candidates.push({ name: 'Groq', run: () => callGroqTextAPIRaw(prompt, settings.groqApiKey, settings.groqModel) });
    }
    // Le provider choisi dans Settings passe en premier
    candidates.sort((a, b) =>
      Number(b.name.toLowerCase() === settings.apiProvider) - Number(a.name.toLowerCase() === settings.apiProvider)
    );

    if (candidates.length === 0) {
      throw new Error('Aucune clé API texte (Gemini, Mistral ou Groq) configurée dans Settings.');
    }

    const errors: string[] = [];
    for (const c of candidates) {
      try {
        const reply = await c.run();
        if (reply) {
          updateFeedback(id, { autoReplyDraft: reply });
          return reply;
        }
        errors.push(`${c.name} : réponse vide`);
      } catch (err: any) {
        errors.push(`${c.name} : ${err.message}`);
      }
    }
    throw new Error(errors.join(' | '));
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

// Convert objectUrl to base64 data URI (for Groq API)
async function objectUrlToBase64DataUri(objectUrl: string): Promise<string> {
  const response = await fetch(objectUrl);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Actual Groq vision API helper (OpenAI-compatible, uses fetch directly)
async function callGroqVisionAPI(objectUrl: string, apiKey: string, modelName: string): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>> {
  const dataUri = await objectUrlToBase64DataUri(objectUrl);

  const prompt = `You are analyzing a photo of a single handwritten customer feedback note.

1. Transcribe the handwritten text as accurately as possible. If words are
   illegible, make your best guess but do not invent content that isn't there.
2.   Decide the overall sentiment: "positive", "neutral", or "negative".
3. Extract up to 5 short themes/topics mentioned (e.g. "staff friendliness",
   "wait time", "pricing"), lowercase, 1-3 words each.
4. If a numeric rating out of 5 is visibly marked (stars, circled number,
   checkboxes), extract it as an integer 1-5, otherwise null.
5. Write a one-sentence summary in your own words.
6. Rate your transcription confidence as "high", "medium", or "low". Use
   "low" if the handwriting is genuinely illegible or the image quality is poor.
7. Write a brief reasoning explaining which key elements or phrases in the
   feedback determined the chosen sentiment (e.g. specific compliments that
   made it positive, specific complaints that made it negative, or mixed
   signals that kept it neutral).

Respond with ONLY a raw JSON object, no markdown fences, no commentary:
{
  "transcription": "string",
  "sentiment": "positive|neutral|negative",
  "themes": ["string"],
  "rating": number|null,
  "summary": "string",
  "confidence": "high|medium|low",
  "sentimentReasoning": "string"
}`;

  const response = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName || 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUri } }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch { /* ignore */ }
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Groq returned an empty response');
  }
  
  // Strip code fences if they are outputted anyway
  const cleanJsonText = text.replace(/^```json\s*/i, '').replace(/```$/g, '').trim();
  const parsed = JSON.parse(cleanJsonText);
  
  return {
    transcription: parsed.transcription || '',
    sentiment: parsed.sentiment || 'neutral',
    sentimentReasoning: parsed.sentimentReasoning || '',
    themes: Array.isArray(parsed.themes) ? parsed.themes.map((t: string) => String(t).toLowerCase()) : [],
    rating: parsed.rating || null,
    summary: parsed.summary || '',
    confidence: parsed.confidence || 'high',
    needsReview: parsed.confidence === 'low',
    source: "Groq AI Analyzer"
  };
}

// Helper // Nettoie les mots-clés renvoyés par le LLM : un mot par entrée, présent dans le texte
const KW_SKIP = new Set(['ne','pas','de','du','la','le','les','un','une','des','et','en','au','qui','que','qu','se','sa','son','the','not','was','is','of','to']);

function toKeywordList(a: unknown, text: string): string[] {
  if (!Array.isArray(a)) return [];
   const lowerText = text.toLowerCase();
  const out = new Set<string>();
  for (const x of a) {
    String(x).toLowerCase().split(/[^\p{L}\p{N}'’-]+/u).forEach(w => {
      if (w.length >= 3 && !KW_SKIP.has(w) && lowerText.includes(w)) out.add(w);
    });
  }
  return Array.from(out).slice(0, 8);
}

function buildKeywords(parsed: any, text: string): { positive: string[]; negative: string[] } | undefined {
  // Si le modèle n'a renvoyé aucune des deux listes, on laisse le secours local s'activer
  if (!Array.isArray(parsed.positive) && !Array.isArray(parsed.negative)) return undefined;
  return { positive: toKeywordList(parsed.positive, text), negative: toKeywordList(parsed.negative, text) };
}

// Helper to map UI model names to valid Gemini API model names
function mapGeminiModel(modelName: string): string {
  const name = modelName ? modelName.trim() : '';
  if (!name || name === 'gemini-3-flash'  || name === 'gemini-2.5-flash') {
    return GEMINI_DEFAULT_MODEL;
  }
  return name;
}

// Gemini Vision API helper (uses fetch directly for zero-dependency reliability in Vite)
async function callGeminiVisionAPI(objectUrl: string, apiKey: string, modelName: string): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>> {
  const dataUri = await objectUrlToBase64DataUri(objectUrl);
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Failed to parse image data format');
  }
  const mimeType = match[1];
  const base64Data = match[2];

  const prompt = `You are analyzing a photo of a single handwritten customer feedback note.

1. Transcribe the handwritten text as accurately as possible. If words are
   illegible, make your best guess but do not invent content that isn't there.
2. Decide the overall sentiment: "positive", "neutral", or "negative".
3. Extract up to 5 short themes/topics mentioned (e.g. "staff friendliness",
   "wait time", "pricing"), lowercase, 1-3 words each.
4. If a numeric rating out of 5 is visibly marked (stars, circled number,
   checkboxes), extract it as an integer 1-5, otherwise null.
5. Write a one-sentence summary in your own words.
6. Rate your transcription confidence as "high", "medium", or "low". Use
   "low" if the handwriting is genuinely illegible or the image quality is poor.
7. Write a brief reasoning explaining which key elements or phrases in the
   feedback determined the chosen sentiment (e.g. specific compliments that
   made it positive, specific complaints that made it negative, or mixed
   signals that kept it neutral).

Respond with ONLY a raw JSON object, no markdown fences, no commentary:
{
  "transcription": "string",
  "sentiment": "positive|neutral|negative",
  "themes": ["string"],
  "rating": number|null,
  "summary": "string",
  "confidence": "high|medium|low",
  "sentimentReasoning": "string",
  "positive": ["string"],
  "negative": ["string"]
}

Additional rules:
- Write "themes" in the SAME language as the transcription (French text -> French themes).
- "positive" and "negative": SINGLE words (one word per entry, never a phrase) copied EXACTLY as written in your transcription, that express a positive or negative judgment in context. Include strong intensifiers and negative verbs/adjectives/nouns (e.g. "extrêmement", "déçu", "casse", "absence").
- Never put product names, brand names or neutral nouns/verbs in these two lists. Take negation and comparison into account.
- Maximum 8 words per list. Empty lists are allowed.`;

  const resolvedModel = mapGeminiModel(modelName);
  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  }, 4); // 4 retries : jusqu'à ~30 s d'attente en cas de surcharge

  if (!response.ok) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch { /* ignore */ }
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  // Strip code fences if they are outputted anyway
  const cleanJsonText = text.replace(/^```json\s*/i, '').replace(/```$/g, '').trim();
  const parsed = JSON.parse(cleanJsonText);

  return {
    transcription: parsed.transcription || '',
    sentiment: parsed.sentiment || 'neutral',
    sentimentReasoning: parsed.sentimentReasoning || '',
    themes: Array.isArray(parsed.themes) ? parsed.themes.map((t: string) => String(t).toLowerCase()) : [],
    rating: parsed.rating || null,
    summary: parsed.summary || '',
    confidence: parsed.confidence || 'high',
    needsReview: parsed.confidence === 'low',
    keywords: buildKeywords(parsed, String(parsed.transcription || '')),
    source: "Gemini AI Analyzer"
  };
}

// ─── OCR.space helper ────────────────────────────────────────────────────────
// Uses OCR Engine 2 (handwriting-optimised) and then runs local sentiment analysis
// so no second LLM key is required.
async function callOCRSpaceAPI(
  objectUrl: string,
  apiKey: string,
  preprocess: boolean = true,
  llm?: LlmKeys
): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>> {
  let dataUri = await objectUrlToBase64DataUri(objectUrl);

  if (preprocess) {
    try {
      const { preprocessForOCR } = await import('./utils/imagePreprocess');
      dataUri = await preprocessForOCR(dataUri, { binarize: true });
    } catch (e) {
      console.warn('Image preprocessing failed, using original image:', e);
    }
  }

  // OCR.space expects just the base64 payload without the data URI prefix
  const base64 = dataUri.split(',')[1];
  const mimeMatch = dataUri.match(/^data:([^;]+);base64,/);
  const filetype = mimeMatch ? mimeMatch[1].split('/')[1] : 'jpg';

  const form = new FormData();
  form.append('base64Image', `data:image/${filetype};base64,${base64}`);
  form.append('apikey', apiKey);
  form.append('OCREngine', '2');        // Engine 2 – better for handwriting
  form.append('language', 'fre');
  form.append('isOverlayRequired', 'false');
  form.append('detectOrientation', 'true');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch { /* ignore */ }
    throw new Error(`OCR.space API error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();

  if (json.IsErroredOnProcessing) {
    throw new Error(`OCR.space processing error: ${json.ErrorMessage?.[0] || 'Unknown error'}`);
  }

  const transcription: string = (json.ParsedResults?.[0]?.ParsedText || '').trim();
  if (!transcription) {
    throw new Error('OCR.space returned empty text — image may be unreadable.');
  }

  return analyzeTextLocally(transcription, llm);
}
// ─── Mistral OCR helper──────────────────────────────────────────────────────
// Uses Mistral OCR for text extraction, then Mistral Chat API for AI-powered
// sentiment / theme / summary analysis. Falls back to local analysis on error.
async function callMistralOCRAPI(objectUrl: string, apiKey: string): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>> {
  const dataUri = await objectUrlToBase64DataUri(objectUrl);
  
  const response = await fetchWithRetry('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        image_url: dataUri
      }
    })
  });

  if (!response.ok) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch { /* ignore */ }
    throw new Error(`Mistral OCR API error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  const transcription: string = (json.pages?.[0]?.markdown || '').trim();
  if (!transcription) {
    throw new Error('Mistral OCR returned empty text — image may be unreadable.');
  }

  // Try Mistral Chat API for AI-powered sentiment analysis
  try {
    const analyzed = await callMistralChatForAnalysis(transcription, apiKey);
    analyzed.source = 'Mistral OCR Analyzer';
    return analyzed;
    } catch (chatErr) {
    console.warn('Mistral Chat analysis failed, falling back to local analysis:', chatErr);
    const analyzed = await analyzeTextLocally(transcription);
    analyzed.source = 'Mistral OCR Analyzer (local analysis)';
    return analyzed;
  }
}

// ─── Mistral Chat API for text-only sentiment analysis ───────────────────────
// OpenAI-compatible endpoint, uses a Mistral chat model to analyse the
// already-transcribed text. Falls back gracefully.
async function callMistralChatForAnalysis(transcription: string, apiKey: string): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>> {
  const prompt = `You are analyzing a piece of customer feedback text that was extracted from an image via OCR.

1. Decide the overall sentiment: "positive", "neutral", or "negative".
2. Extract up to 5 short themes/topics mentioned (e.g. "staff friendliness", "wait time", "pricing"), lowercase, 1-3 words each.
3. If a numeric rating out of 5 is mentioned explicitly (e.g. "4/5", "3 stars"), extract it as an integer 1-5, otherwise null.
4. Write a one-sentence summary in your own words.
5. Rate your confidence in the analysis as "high", "medium", or "low".
6. Write a brief reasoning explaining which key elements or phrases in the feedback determined the chosen sentiment.

Text: "${transcription}"

Respond with ONLY a raw JSON object, no markdown fences, no commentary:
{
  "transcription": "${transcription}",
  "sentiment": "positive|neutral|negative",
  "themes": ["string"],
  "rating": number|null,
  "summary": "string",
  "confidence": "high|medium|low",
  "sentimentReasoning": "string"
}`;

   const response = await fetchWithRetry('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    let errorBody = '';
    try { errorBody = await response.text(); } catch { /* ignore */ }
    throw new Error(`Mistral Chat API error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Mistral Chat returned an empty response');
  }

  // Strip code fences if they are outputted anyway
  const cleanJsonText = text.replace(/^```json\s*/i, '').replace(/```$/g, '').trim();
  const parsed = JSON.parse(cleanJsonText);

  return {
    transcription: parsed.transcription || transcription,
    sentiment: parsed.sentiment || 'neutral',
    sentimentReasoning: parsed.sentimentReasoning || '',
    themes: Array.isArray(parsed.themes) ? parsed.themes.map((t: string) => String(t).toLowerCase()) : [],
    rating: parsed.rating ?? null,
    summary: parsed.summary || '',
    confidence: parsed.confidence || 'medium',
    needsReview: parsed.confidence === 'low',
    source: 'Mistral OCR Analyzer'
  };
}

// ─── Local sentiment / theme analysis ────────────────────────────────────────
// Runs purely in the browser after OCR transcription — no external API needed.
// ─── Local sentiment / theme analysis ────────────────────────────────────────
// Runs purely in the browser after OCR transcription — no external API needed.
// Improvements vs the naive version: whole-word matching (not substrings),
// simple negation handling ("not good", "pas bien"), and FR + EN keywords.
// ─── Local sentiment analysis ────────────────────────────────────────────────
// Sentiment is computed by a real ML model (transformers.js, runs in-browser),
// not a keyword list — it generalizes to words it has never seen literally.
// Themes stay keyword-based (no lightweight general-purpose model for that yet),
// so they're a best-effort hint, not a hard guarantee.
// ─── Extraction automatique des thèmes (LLM, aucune liste de mots) ───────────
interface LlmKeys {
  geminiApiKey?: string; geminiModel?: string;
  mistralApiKey?: string;
  groqApiKey?: string; groqModel?: string;
}

function llmKeysOf(s: AppSettings): LlmKeys {
  return {
    geminiApiKey: s.geminiApiKey, geminiModel: s.geminiModel,
    mistralApiKey: s.mistralApiKey,
    groqApiKey: s.groqApiKey, groqModel: s.groqModel,
  };
}

interface Insights {
  themes: string[];
  keywords?: { positive: string[]; negative: string[] };
  error?: string;
}

async function extractInsightsAuto(text: string, k?: LlmKeys): Promise<Insights> {
  if (!k) return { themes: [], error: 'aucune clé LLM fournie' };
  const prompt = `Analyze this customer feedback. The text may contain OCR errors: infer the intended meaning.

Return ONLY a JSON object with exactly these keys:
- "themes": 1 to 5 short topics (1 to 3 words each), lowercase, in the SAME language as the text.
- "positive": SINGLE words (one word per entry, never a phrase) copied EXACTLY as written in the text that express a positive judgment in context.
- "negative": SINGLE words (one word per entry, never a phrase) copied EXACTLY as written in the text that express a negative judgment in context. Include strong intensifiers and negative verbs/adjectives/nouns (e.g. "extrêmement", "déçu", "casse", "absence").

Rules for "positive" and "negative":
- Only words that carry an opinion or emotion in context. Never product names, brand names, or neutral nouns/verbs.
- Take negation and comparison into account (e.g. "a better quality brand" said about ANOTHER brand is a criticism of the reviewed product).
- Maximum 8 words per list. Empty lists are allowed.

Text: """${text.slice(0, 2000)}"""`;

  const runners: Array<{ name: string; run: () => Promise<string> }> = [];
  if (k.geminiApiKey) runners.push({ name: 'Gemini', run: () => callGeminiTextAPIRaw(prompt, k.geminiApiKey!, k.geminiModel ?? '') });
  if (k.mistralApiKey) runners.push({ name: 'Mistral', run: () => callMistralTextAPIRaw(prompt, k.mistralApiKey!) });
  if (k.groqApiKey) runners.push({ name: 'Groq', run: () => callGroqTextAPIRaw(prompt, k.groqApiKey!, k.groqModel ?? '') });
  if (runners.length === 0) return { themes: [], error: 'aucune clé API texte configurée' };

  const lowerText = text.toLowerCase();
  const errors: string[] = [];
  for (const r of runners) {
    try {
      const raw = await r.run();
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) { errors.push(`${r.name} : réponse non JSON`); continue; }
            console.log('Insights bruts', r.name, m[0]);
      const obj = JSON.parse(m[0]);
      const themes = Array.isArray(obj.themes)
        ? obj.themes.map((x: unknown) => String(x).toLowerCase().trim()).filter(Boolean).slice(0, 5)
        : [];
      return {
        themes,
        keywords: {
          positive: toKeywordList(obj.positive, text),
          negative: toKeywordList(obj.negative, text),
        },
      };
    } catch (e: any) {
      errors.push(`${r.name} : ${e.message}`);
    }
  }
  return { themes: [], error: errors.join(' | ').slice(0, 300) };
}

async function analyzeTextLocally(transcription: string, llm?: LlmKeys): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>> {
  const lower = transcription.toLowerCase();
  const words = lower.match(/[a-zà-ÿ']+/g) ?? [];

  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  let sentimentReasoning = '';
  let modelConfidence = 0;

  try {
    const { classifySentiment } = await import('./utils/localSentiment');
    const result = await classifySentiment(transcription);
    sentiment = result.label;
    modelConfidence = result.score;
    sentimentReasoning = `Local multilingual model (star-rating classifier) predicted "${sentiment}" with ${Math.round(result.score * 100)}% confidence.`;
  } catch (e) {
    console.error('Local sentiment model failed, defaulting to neutral:', e);
    sentimentReasoning = 'Local ML model unavailable — defaulted to neutral. Try again or switch provider in Settings.';
  }

    // Thèmes : extraits automatiquement par le LLM si une clé est disponible
  const insights = await extractInsightsAuto(transcription, llm);
  const themes = insights.themes;
  if (insights.error) {
    console.warn('Thèmes/mots-clés indisponibles :', insights.error);
        sentimentReasoning += ' (Mots-clés approximatifs : les services IA étaient indisponibles, utilisez Re-analyze plus tard.)';
  }
  
  // Rating from digits — look for "X/5", "X stars", "X etoiles"
  let rating: number | null = null;
  const ratingMatch = lower.match(/(\d)\s*(?:\/\s*5|stars?|out of 5|etoiles?)/);
  if (ratingMatch) {
    const r = parseInt(ratingMatch[1], 10);
    if (r >= 1 && r <= 5) rating = r;
  }

  // Confidence blends model confidence and text length (very short text is unreliable either way)
  const wordCount = words.length;
  const lengthOk = wordCount >= 6;
  const confidence: 'high' | 'medium' | 'low' =
    modelConfidence >= 0.85 && lengthOk ? 'high' :
    modelConfidence >= 0.6 ? 'medium' : 'low';

  const firstSentence = transcription.split(/[.!?]/)[0].trim();
  const summary = firstSentence.length > 10
    ? firstSentence.length > 100 ? firstSentence.substring(0, 100) + '…' : firstSentence
    : `OCR-extracted feedback: ${transcription.substring(0, 80)}`;

  return {
    transcription,
    sentiment,
    sentimentReasoning,
    themes: themes.slice(0, 5),
    keywords: insights.keywords,
    rating,
    summary,
    confidence,
    needsReview: confidence === 'low',
    source: 'OCR.space (Local ML)'
  };
}// ─── Text-only sentiment prompt ───────────────────────────────────────────────
function buildTextOnlySentimentPrompt(transcription: string): string {
  return `You are analyzing a piece of customer feedback text (already transcribed).

1. Decide the overall sentiment: "positive", "neutral", or "negative".
2. Extract up to 5 short themes/topics mentioned (e.g. "staff friendliness", "wait time", "pricing"), lowercase, 1-3 words each.
3. If a numeric rating out of 5 is mentioned, extract it as an integer 1-5, otherwise null.
4. Write a one-sentence summary in your own words.
5. Rate your confidence as "high", "medium", or "low".
6. Write a brief reasoning explaining the sentiment determination.

Text: "${transcription}"

Respond with ONLY a raw JSON object:
{
  "transcription": "${transcription}",
  "sentiment": "positive|neutral|negative",
  "themes": ["string"],
  "rating": number|null,
  "summary": "string",
  "confidence": "high|medium|low",
  "sentimentReasoning": "string"
}`;
}

// ─── Groq text-only API (no image) ───────────────────────────────────────────
async function callGroqTextAPI(prompt: string, apiKey: string, modelName: string): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName || DEFAULT_GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });
  if (!response.ok) throw new Error(`Groq text API error (${response.status})`);
  const json = await response.json();
  const text = json.choices?.[0]?.message?.content?.trim() ?? '';
  const parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/g, '').trim());
  return {
    transcription: parsed.transcription || '',
    sentiment: parsed.sentiment || 'neutral',
    sentimentReasoning: parsed.sentimentReasoning || '',
    themes: Array.isArray(parsed.themes) ? parsed.themes.map((t: string) => String(t).toLowerCase()) : [],
    rating: parsed.rating || null,
    summary: parsed.summary || '',
    confidence: parsed.confidence || 'medium',
    needsReview: parsed.confidence === 'low',
    source: 'Groq AI (Re-analyzed)'
  };
}

// ─── Gemini text-only API (no image) ─────────────────────────────────────────
async function callGeminiTextAPI(prompt: string, apiKey: string, modelName: string): Promise<Omit<FeedbackRecord, 'id' | 'timestamp'>> {
  const resolvedModel = mapGeminiModel(modelName);
  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  }, 4); // 4 retries : jusqu'à ~30 s d'attente en cas de surcharge
  if (!response.ok) throw new Error(`Gemini text API error (${response.status})`);
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  const parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/g, '').trim());
  return {
    transcription: parsed.transcription || '',
    sentiment: parsed.sentiment || 'neutral',
    sentimentReasoning: parsed.sentimentReasoning || '',
    themes: Array.isArray(parsed.themes) ? parsed.themes.map((t: string) => String(t).toLowerCase()) : [],
    rating: parsed.rating || null,
    summary: parsed.summary || '',
    confidence: parsed.confidence || 'medium',
    needsReview: parsed.confidence === 'low',
    source: 'Gemini AI (Re-analyzed)'
  };
}

// ─── Raw text generation (for auto-reply) ────────────────────────────────────
async function callGroqTextAPIRaw(prompt: string, apiKey: string, modelName: string): Promise<string> {
  const response = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName || DEFAULT_GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
    })
  });
  if (!response.ok) throw new Error(`Groq API error (${response.status})`);
  const json = await response.json();
  return json.choices?.[0]?.message?.content?.trim() ?? '';
}

async function callGeminiTextAPIRaw(prompt: string, apiKey: string, modelName: string): Promise<string> {
  const resolvedModel = mapGeminiModel(modelName);
  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  if (!response.ok) {
    let body = '';
    try { body = (await response.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error(`Gemini API error (${response.status}) ${body}`);
  }
  const json = await response.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

// ─── Mistral raw text generation (for auto-reply) ───────────────────────────
async function callMistralTextAPIRaw(prompt: string, apiKey: string): Promise<string> {
  const response = await fetchWithRetry('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) {
    let body = '';
    try { body = (await response.text()).slice(0, 300); } catch { /* ignore */ }
    throw new Error(`Mistral Chat API error (${response.status}) ${body}`);
  }
  const json = await response.json();
  return json.choices?.[0]?.message?.content?.trim() ?? '';
}
