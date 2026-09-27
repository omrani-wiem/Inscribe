export interface Respondent {
  name?: string;
  avatarUrl?: string;
  email?: string;
}

export interface FeedbackRecord {
  id: string;
  timestamp: string; // ISO 8601
  transcription: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  themes: string[]; // lowercase, deduplicated
  rating: number | null; // 1-5
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  sentimentReasoning: string;
  needsReview: boolean;
  source?: string;
  respondent?: Respondent;
  reviewedAndEdited?: boolean;
  // New extended fields
  tags?: string[];           // custom user-defined labels
  duplicateOf?: string;      // id of the record this is a near-duplicate of
  autoReplyDraft?: string;   // LLM-generated reply suggestion
  language?: string;         // detected language code, e.g. 'fr', 'ar'
  scannedImage?: string;     // base64 data URI of the compressed scanned image
}

export interface QueueItem {
  id: string;
  fileName: string;
  fileSize: number;
  objectUrl: string; // for local previews
  status: 'queued' | 'reading' | 'done' | 'failed';
  progress: number; // 0 to 100
  transcriptionPreview?: string;
  error?: string;
  result?: Omit<FeedbackRecord, 'id' | 'timestamp'>;
}

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  recipientEmail: string;
}

export interface AppSettings {
  apiProvider: 'groq' | 'gemini' | 'ocr' | 'mistral';
  groqApiKey: string;
  groqModel: string;
  geminiApiKey: string;
  geminiModel: string;
  ocrSpaceApiKey: string;
  mistralApiKey: string;
  defaultDateRange: '7d' | '30d' | '90d' | 'all';
  darkMode: boolean;
  alertThreshold: number;    // 0–100, negative feedback % that triggers alert banner
  emailJsConfig: EmailJsConfig;
}

