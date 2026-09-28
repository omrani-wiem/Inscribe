import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { FeedbackRecord } from '../types';
import '@material/web/checkbox/checkbox.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/dialog/dialog.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/fab/fab.js';

/* ── Typewriter Effect Component ── */
function TypewriterText({ 
  text, 
  speed = 25, 
  enabled = true 
}: { 
  text: string; 
  speed?: number; 
  enabled?: boolean;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTyping = useCallback(() => {
    if (!enabled) {
      setDisplayedText(text);
      return;
    }
    indexRef.current = 0;
    setDisplayedText('');
    setIsTyping(true);

    const typeChar = () => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
        
        // Variable speed: pause slightly longer on punctuation
        const char = text[indexRef.current - 1];
        let delay = speed;
        if (char === '.' || char === '!' || char === '?') delay = speed * 4;
        else if (char === ',' || char === ';' || char === ':') delay = speed * 2;
        else if (char === '\n') delay = speed * 3;
        
        timerRef.current = setTimeout(typeChar, delay);
      } else {
        setIsTyping(false);
      }
    };

    timerRef.current = setTimeout(typeChar, 120);
  }, [text, speed, enabled]);

  useEffect(() => {
    startTyping();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startTyping]);

  return (
    <span className="typewriter-text">
      {displayedText}
      {isTyping && <span className="typewriter-cursor" />}
    </span>
  );
}

/* ── Sentiment Keyword Detection ── */
const POSITIVE_KEYWORDS = [
  'love', 'loved', 'loving', 'excellent', 'great', 'amazing', 'wonderful', 'fantastic',
  'awesome', 'perfect', 'beautiful', 'nice', 'friendly', 'clean', 'cozy', 'fast',
  'delicious', 'recommend', 'happy', 'best', 'superb', 'outstanding', 'incredible',
  'delightful', 'pleasant', 'helpful', 'comfortable', 'impressive', 'convenient',
  'brilliant', 'lovely', 'super', 'tasty', 'fresh', 'warm', 'kind', 'fabulous',
  'terrific', 'splendid', 'enjoyed', 'pleased', 'amazed', 'thrilled', 'grateful',
  'perfectly', 'wonderfully', 'excellently'
];

const NEGATIVE_KEYWORDS = [
  'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst', 'dirty', 'slow',
  'cold', 'expensive', 'overpriced', 'rude', 'broken', 'disgusting', 'hate',
  'hated', 'disappointed', 'disappointing', 'sucks', 'complaint', 'ugly',
  'stale', 'tasteless', 'gross', 'rotten', 'sad', 'angry', 'frustrated',
  'annoyed', 'upset', 'boring', 'bored', 'painful', 'difficult', 'hard',
  'impossible', 'waste', 'horribly', 'terribly', 'dreadful', 'lousy', 'mediocre',
  'unpleasant', 'uncomfortable', 'unhelpful', 'unfriendly', 'disaster'
];

const NEUTRAL_KEYWORDS = [
  'okay', 'ok', 'average', 'decent', 'fine', 'alright', 'maybe', 'somewhat',
  'quite', 'fairly', 'normal', 'standard', 'typical', 'acceptable', 'moderate',
  'sufficient', 'adequate', 'tolerable', 'passable', 'ordinary', 'so-so'
];

function getWordAttribution(word: string): { weight: number; type: 'positive' | 'negative' | 'neutral' } {
  const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const strongPositive = ['love', 'loved', 'excellent', 'amazing', 'wonderful', 'perfect', 'best', 'superb', 'fantastic', 'outstanding'];
  const strongNegative = ['terrible', 'awful', 'horrible', 'worst', 'dirty', 'rude', 'broken', 'disaster'];

  if (strongPositive.includes(cleanWord)) {
    return { weight: 0.95, type: 'positive' };
  }
  if (POSITIVE_KEYWORDS.includes(cleanWord)) {
    return { weight: 0.70, type: 'positive' };
  }
  if (strongNegative.includes(cleanWord)) {
    return { weight: -0.95, type: 'negative' };
  }
  if (NEGATIVE_KEYWORDS.includes(cleanWord)) {
    return { weight: -0.70, type: 'negative' };
  }
  if (NEUTRAL_KEYWORDS.includes(cleanWord)) {
    return { weight: 0.15, type: 'neutral' };
  }
  
  return { weight: 0, type: 'neutral' };
}

function extractKeywords(text: string): { positive: string[]; negative: string[]; neutral: string[] } {
  const tokens = text.split(/[\s.,!?;:()""'']+/).filter(Boolean);
  const found = { positive: new Set<string>(), negative: new Set<string>(), neutral: new Set<string>() };
  
  tokens.forEach(token => {
    const cleanWord = token.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleanWord) return;
    
    if (POSITIVE_KEYWORDS.includes(cleanWord)) {
      found.positive.add(cleanWord);
    } else if (NEGATIVE_KEYWORDS.includes(cleanWord)) {
      found.negative.add(cleanWord);
    } else if (NEUTRAL_KEYWORDS.includes(cleanWord)) {
      found.neutral.add(cleanWord);
    }
  });
  
  return {
    positive: Array.from(found.positive),
    negative: Array.from(found.negative),
    neutral: Array.from(found.neutral)
  };
}

/**
 * Occlusion attribution: for each word, we compute the text's total keyword score
 * WITH and WITHOUT that word, and the difference becomes its displayed weight.
 * This is a real (if simple) computation, not a random or hard-coded value.
 */
function scoreTokens(tokens: Array<{ token: string; isWord: boolean }>, skipIndex: number): number {
  let score = 0;
  tokens.forEach((t, i) => {
    if (!t.isWord || i === skipIndex) return;
    const cleanWord = t.token.toLowerCase().replace(/[^a-z0-9]/g, '');
    score += getWordAttribution(cleanWord).weight;
  });
  return score;
}

function getTranscriptAttribution(
  text: string
): Array<{ token: string; isWord: boolean; weight: number }> {
  const rawTokens = text.split(/(\s+|[.,!?;:()""''])/g).filter(Boolean);
  const tokens = rawTokens.map(token => ({
    token,
    isWord: /^[a-zA-Z0-9'-]+$/.test(token)
  }));

  const baseScore = scoreTokens(tokens, -1);
  const maxAbs = Math.max(0.01, ...tokens.map((t, i) => t.isWord ? Math.abs(baseScore - scoreTokens(tokens, i)) : 0));

  return tokens.map((t, i) => {
    if (!t.isWord) return { ...t, weight: 0 };
    const impact = baseScore - scoreTokens(tokens, i);
    return { ...t, weight: impact / maxAbs }; // normalised to [-1, 1] for display
  });
}
function renderHighlightedText(
  text: string,
  keywords: ReturnType<typeof extractKeywords>,
  mode: 'keywords' | 'occlusion'
): React.ReactNode {
  if (!text) return null;
  
  if (mode === 'occlusion') {
    const attributions = getTranscriptAttribution(text);
    return attributions.map((item, index) => {
      if (!item.isWord) {
        return <span key={index}>{item.token}</span>;
      }
      
      const weight = item.weight;
      if (weight > 0.01) {
        const alpha = Math.max(0.1, weight * 0.85);
        return (
          <mark 
            key={index} 
            className="kw-highlight" 
            style={{ 
              backgroundColor: `rgba(46, 125, 50, ${alpha})`, 
              color: 'var(--sentiment-positive-on-container)', 
              borderBottom: `2px solid rgba(46, 125, 50, ${weight})`,
              cursor: 'help'
            }}
            title={`Occlusion impact: +${weight.toFixed(2)} (removing this word lowers the score)`}
          >
            {item.token}
          </mark>
        );
      } else if (weight < -0.01) {
        const alpha = Math.max(0.1, Math.abs(weight) * 0.85);
        return (
          <mark 
            key={index} 
            className="kw-highlight" 
            style={{ 
              backgroundColor: `rgba(211, 47, 47, ${alpha})`, 
              color: 'var(--sentiment-negative-on-container)', 
              borderBottom: `2px solid rgba(211, 47, 47, ${Math.abs(weight)})`,
              cursor: 'help'
            }}
            title={`Occlusion impact: ${weight.toFixed(2)} (removing this word raises the score)`}
          >
            {item.token}
          </mark>
        );
      } else {
        return <span key={index}>{item.token}</span>;
      }
    });
  } else {
    // Keywords Mode
    const tokens = text.split(/(\s+|[.,!?;:()""''])/g).filter(Boolean);
    return tokens.map((token, index) => {
      const isWord = /^[a-zA-Z0-9'-]+$/.test(token);
      if (!isWord) {
        return <span key={index}>{token}</span>;
      }
      
      const cleanWord = token.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isPositive = keywords.positive.some(w => w.toLowerCase() === cleanWord);
      const isNegative = keywords.negative.some(w => w.toLowerCase() === cleanWord);
      const isNeutral = keywords.neutral.some(w => w.toLowerCase() === cleanWord);
      
      if (isPositive) {
        return (
          <mark key={index} className="kw-highlight kw-positive">
            {token}
          </mark>
        );
      } else if (isNegative) {
        return (
          <mark key={index} className="kw-highlight kw-negative">
            {token}
          </mark>
        );
      } else if (isNeutral) {
        return (
          <mark key={index} className="kw-highlight kw-neutral">
            {token}
          </mark>
        );
      } else {
        return <span key={index}>{token}</span>;
      }
    });
  }
}

interface FeedbackTableProps {
  data: FeedbackRecord[];
  updateFeedback: (id: string, updatedFields: Partial<FeedbackRecord>) => void;
  deleteFeedback: (id: string) => void;
  deleteMultipleFeedback: (ids: string[]) => void;
  themeFilter: string;
  setThemeFilter: (theme: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedFeedback: FeedbackRecord | null;
  setSelectedFeedback: (item: FeedbackRecord | null) => void;
  // New actions
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  reAnalyzeFeedback: (id: string) => void;
  generateAutoReply: (id: string) => Promise<string | null>;
}

export default function FeedbackTable({
  data,
  updateFeedback,
  deleteFeedback,
  deleteMultipleFeedback,
  themeFilter,
  setThemeFilter,
  searchQuery,
  setSearchQuery,
  selectedFeedback: selectedSnapshot,
  setSelectedFeedback,
  addTag,
  removeTag,
  reAnalyzeFeedback,
  generateAutoReply
}: FeedbackTableProps) {
  // Filters & Sorting state
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [sortField, setSortField] = useState<'timestamp' | 'sentiment' | 'rating'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Selected row IDs for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Carousel index in processedData for the detail modal
  const [carouselIndex, setCarouselIndex] = useState<number>(-1);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');

  // Tagging & Auto-reply states
  const [newTagText, setNewTagText] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [isReAnalyzing, setIsReAnalyzing] = useState(false);

  // Editing state for inspection dialog
  const [editTranscription, setEditTranscription] = useState('');
  const [editSentiment, setEditSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral');
  const [editRating, setEditRating] = useState<number | null>(null);
  const [editThemes, setEditThemes] = useState('');
    const [highlightMode, setHighlightMode] = useState<'keywords' | 'occlusion'>('keywords');


    // Version toujours à jour du record (tags, re-analyse…) au lieu d'un instantané
  const selectedFeedback = useMemo(
    () => selectedSnapshot ? (data.find(f => f.id === selectedSnapshot.id) ?? selectedSnapshot) : null,
    [data, selectedSnapshot]
  );

  // Remplit les champs d'édition quelle que soit l'origine de l'ouverture (Overview ou tableau)
  useEffect(() => {
    if (!selectedSnapshot) return;
    setEditTranscription(selectedSnapshot.transcription);
    setEditSentiment(selectedSnapshot.sentiment);
    setEditRating(selectedSnapshot.rating);
    setEditThemes(selectedSnapshot.themes.join(', '));
    setCarouselIndex(processedDataRef.current.findIndex(d => d.id === selectedSnapshot.id));
  }, [selectedSnapshot?.id]);

  
  // Keyword analysis for the selected feedback (live from transcription)
  const keywordAnalysis = useMemo(() => {
    if (!selectedFeedback) return null;
    return extractKeywords(editTranscription || selectedFeedback.transcription);
  }, [selectedFeedback, editTranscription]);
  // Extract all unique themes for filter dropdown
  const allThemes = useMemo(() => {
    const themes = new Set<string>();
    data.forEach(item => item.themes.forEach(t => themes.add(t.toLowerCase().trim())));
    return Array.from(themes).sort();
  }, [data]);

  // Handle individual row select checkbox
  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  };

  // Handle select all
  const handleSelectAll = (checked: boolean, visibleIds: string[]) => {
    if (checked) {
      setSelectedIds(visibleIds);
    } else {
      setSelectedIds([]);
    }
  };

  // Open detail modal, track index in processedData for carousel nav
  const handleOpenRowDetails = (item: FeedbackRecord, index?: number) => {
    const idx = index !== undefined ? index : processedDataRef.current.findIndex(d => d.id === item.id);
    setCarouselIndex(idx);
    setSelectedFeedback(item);
    setEditTranscription(item.transcription);
    setEditSentiment(item.sentiment);
    setEditRating(item.rating);
    setEditThemes(item.themes.join(', '));
  };

  // Carousel navigation
  const handleCarouselNav = (dir: 'prev' | 'next') => {
    const list = processedDataRef.current;
    const newIdx = dir === 'prev' ? carouselIndex - 1 : carouselIndex + 1;
    if (newIdx < 0 || newIdx >= list.length) return;
    setSlideDir(dir === 'next' ? 'left' : 'right');
    handleOpenRowDetails(list[newIdx], newIdx);
  };

  // Save changes from detail dialog
  const handleSaveDetails = () => {
    if (!selectedFeedback) return;

    const themesList = editThemes
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    updateFeedback(selectedFeedback.id, {
      transcription: editTranscription,
      sentiment: editSentiment,
      rating: editRating,
      themes: themesList,
      needsReview: false,
      reviewedAndEdited: true
    });

    setSelectedFeedback(null);
  };

  const handleDeleteItem = () => {
    if (!selectedFeedback) return;
    deleteFeedback(selectedFeedback.id);
    setSelectedFeedback(null);
  };

  // Keep a ref to processedData for carousel nav (avoids stale closure)
  const processedDataRef = React.useRef<FeedbackRecord[]>([]);

  // Filtered and Sorted Data
  const processedData = useMemo(() => {
    let result = [...data];

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.transcription.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.source && item.source.toLowerCase().includes(q)) ||
        item.themes.some(t => t.toLowerCase().includes(q)) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Sentiment Filter
    if (sentimentFilter !== 'all') {
      result = result.filter(item => item.sentiment === sentimentFilter);
    }

    // Confidence Filter
    if (confidenceFilter !== 'all') {
      result = result.filter(item => item.confidence === confidenceFilter);
    }

    // Theme Filter
    if (themeFilter) {
      result = result.filter(item => item.themes.includes(themeFilter));
    }

    // Sorting
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // Handle null ratings
      if (sortField === 'rating') {
        valA = valA === null ? -1 : valA;
        valB = valB === null ? -1 : valB;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    processedDataRef.current = result;
    return result;
  }, [data, searchQuery, sentimentFilter, confidenceFilter, themeFilter, sortField, sortOrder]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedData.slice(start, start + itemsPerPage);
  }, [processedData, currentPage]);

  const totalPages = Math.ceil(processedData.length / itemsPerPage) || 1;
  const visibleIds = paginatedData.map(i => i.id);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

  // Bulk Actions
  const handleBulkDelete = () => {
    if (window.confirm(`Delete the ${selectedIds.length} selected items?`)) {
      deleteMultipleFeedback(selectedIds);
      setSelectedIds([]);
    }
  };

  // Export to CSV helper
    const csvCell = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // anti-injection de formules Excel
    return `"${s.replace(/"/g, '""')}"`;
  };

  const handleExportCSV = (itemsToExport = processedData) => {
    const headers = ['ID', 'Timestamp', 'Sentiment', 'Rating', 'Confidence', 'Themes', 'Summary', 'Transcription', 'Source'];
    const rows = itemsToExport.map(item => [
      item.id, item.timestamp, item.sentiment, item.rating ?? '', item.confidence,
      item.themes.join('; '), item.summary, item.transcription, item.source ?? ''
    ].map(csvCell).join(','));

    // \uFEFF (BOM) : Excel lit correctement les accents et l'arabe
    const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `feedback_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getSentimentPill = (sentiment: 'positive' | 'neutral' | 'negative') => {
    const styles = {
      positive: { bg: 'var(--sentiment-positive-container)', fg: 'var(--sentiment-positive-on-container)' },
      neutral: { bg: 'var(--sentiment-neutral-container)', fg: 'var(--sentiment-neutral-on-container)' },
      negative: { bg: 'var(--sentiment-negative-container)', fg: 'var(--sentiment-negative-on-container)' }
    };
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '100px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        textTransform: 'capitalize',
        backgroundColor: styles[sentiment].bg,
        color: styles[sentiment].fg,
        display: 'inline-block'
      }}>
        {sentiment}
      </span>
    );
  };

  const getStatusPill = (item: FeedbackRecord) => {
    if (item.duplicateOf) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: 'var(--sentiment-neutral-container)', color: 'var(--sentiment-neutral-on-container)' }}>
          Duplicate
        </span>
      );
    }
    if (item.reviewedAndEdited) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid var(--md-sys-color-primary)', color: 'var(--md-sys-color-primary)' }}>
          Reviewed & Edited
        </span>
      );
    }
    if (item.needsReview) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: 'var(--sentiment-negative-container)', color: 'var(--sentiment-negative-on-container)' }}>
          Needs Review
        </span>
      );
    }
    return (
      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', backgroundColor: 'var(--sentiment-positive-container)', color: 'var(--sentiment-positive-on-container)' }}>
        Reviewed
      </span>
    );
  };

  const handleSort = (field: 'timestamp' | 'sentiment' | 'rating') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
      
      {/* Dynamic Toolbar (Filters vs Bulk Selection Actions) */}
      <div style={{
        border: '1px solid var(--md-sys-color-outline-variant)',
        borderRadius: '12px',
        backgroundColor: selectedIds.length > 0 ? 'var(--md-sys-color-secondary-container)' : 'var(--md-sys-color-surface)',
        color: selectedIds.length > 0 ? 'var(--md-sys-color-on-secondary-container)' : 'inherit',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',            transition: 'all var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
          }}>
        {selectedIds.length > 0 ? (
          /* Bulk Actions Mode */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
              {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <md-text-button onClick={() => setSelectedIds([])} style={{ '--md-text-button-label-text-color': 'var(--md-sys-color-on-secondary-container)' }}>
                Cancel
              </md-text-button>
              <md-outlined-button onClick={() => handleExportCSV(processedData.filter(d => selectedIds.includes(d.id)))}>
                <md-icon slot="icon">download</md-icon>
                Export Selected
              </md-outlined-button>
              <md-outlined-button onClick={async () => {
                if (window.confirm(`Re-analyze the ${selectedIds.length} selected items using the current Vision AI provider?`)) {
                  for (const id of selectedIds) {
                    await reAnalyzeFeedback(id);
                  }
                  alert('Bulk re-analysis complete.');
                  setSelectedIds([]);
                }
              }}>
                <md-icon slot="icon">refresh</md-icon>
                Re-analyze Selected
              </md-outlined-button>
              <md-filled-button onClick={handleBulkDelete} style={{ '--md-filled-button-container-color': 'var(--sentiment-negative)', '--md-filled-button-label-text-color': '#fff' }}>
                <md-icon slot="icon">delete</md-icon>
                Delete Selected
              </md-filled-button>
            </div>
          </div>
        ) : (
          /* Normal Filters Mode */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              {/* Sentiment filter */}
              <md-outlined-select
                label="Sentiment"
                value={sentimentFilter}
                onClose={(e: any) => { setSentimentFilter(e.target.value); setCurrentPage(1); }}
                quick
                style={{ minWidth: '220px', '--md-select-text-field-container-shape': '8px' }}
              >
                <md-select-option value="all"><div slot="headline">All Sentiments</div></md-select-option>
                <md-select-option value="positive"><div slot="headline">Positive</div></md-select-option>
                <md-select-option value="neutral"><div slot="headline">Neutral</div></md-select-option>
                <md-select-option value="negative"><div slot="headline">Negative</div></md-select-option>
              </md-outlined-select>

              {/* Confidence filter */}
              <md-outlined-select
                label="Confidence"
                value={confidenceFilter}
                onClose={(e: any) => { setConfidenceFilter(e.target.value); setCurrentPage(1); }}
                quick
                style={{ minWidth: '220px', '--md-select-text-field-container-shape': '8px' }}
              >
                <md-select-option value="all"><div slot="headline">All Confidence</div></md-select-option>
                <md-select-option value="high"><div slot="headline">High</div></md-select-option>
                <md-select-option value="medium"><div slot="headline">Medium</div></md-select-option>
                <md-select-option value="low"><div slot="headline">Low</div></md-select-option>
              </md-outlined-select>

              {/* Theme filter */}
              <md-outlined-select
                label="Theme"
                value={themeFilter}
                onClose={(e: any) => { setThemeFilter(e.target.value); setCurrentPage(1); }}
                quick
                style={{ minWidth: '220px', '--md-select-text-field-container-shape': '8px' }}
              >
                <md-select-option value=""><div slot="headline">All Themes</div></md-select-option>
                {allThemes.map(t => (
                  <md-select-option key={t} value={t}>
                    <div slot="headline" style={{ textTransform: 'capitalize' }}>{t}</div>
                  </md-select-option>
                ))}
              </md-outlined-select>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {themeFilter && (
                <md-text-button onClick={() => setThemeFilter('')}>
                  Clear Theme Filter
                </md-text-button>
              )}
              <md-fab
                size="small"
                title="Export to CSV"
                onClick={() => handleExportCSV()}
                style={{
                  '--md-fab-container-color': 'var(--md-sys-color-primary)',
                  '--md-fab-icon-color': 'var(--md-sys-color-on-primary)',
                }}
              >
                <md-icon slot="icon">download</md-icon>
              </md-fab>
            </div>
          </>
        )}
      </div>

      {/* Main Table Card */}
      <div className="m3-table-container">
        {paginatedData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            No matching feedback records found.
          </div>
        ) : (
          <table className="m3-table">
            <thead>
              <tr>
                <th style={{ width: '48px', textAlign: 'center' }}>
                  <md-checkbox
                    checked={isAllVisibleSelected}
                    indeterminate={selectedIds.length > 0 && !isAllVisibleSelected}
                    onClick={(e: any) => handleSelectAll(e.target.checked, visibleIds)}
                  />
                </th>
                <th className="md-typescale-label-medium">Feedback ID</th>
                <th className="md-typescale-label-medium">Created By</th>
                <th onClick={() => handleSort('sentiment')} style={{ cursor: 'pointer' }} className="sortable-header md-typescale-label-medium">
                  Sentiment {sortField === 'sentiment' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th className="md-typescale-label-medium">Primary Theme</th>
                <th className="md-typescale-label-medium">Message</th>
                <th className="md-typescale-label-medium">Status</th>
                <th onClick={() => handleSort('rating')} style={{ cursor: 'pointer' }} className="sortable-header md-typescale-label-medium">
                  Rating {sortField === 'rating' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('timestamp')} style={{ cursor: 'pointer' }} className="sortable-header md-typescale-label-medium">
                  Date {sortField === 'timestamp' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, pageIdx) => {
                const isSelected = selectedIds.includes(item.id);
                const globalIdx = (currentPage - 1) * itemsPerPage + pageIdx;
                return (
                  <tr 
                    key={item.id} 
                    className={isSelected ? 'selected' : ''}
                    onClick={() => handleOpenRowDetails(item, globalIdx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <md-checkbox
                        checked={isSelected}
                        onClick={(e: any) => handleSelectRow(item.id, e.target.checked)}
                      />
                    </td>
                    <td className="md-typescale-body-small" style={{ fontWeight: 'bold' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.id}
                        {item.duplicateOf && (
                          <md-icon style={{ color: 'var(--sentiment-neutral)', fontSize: '16px' }} title={`Possible duplicate of ${item.duplicateOf}`}>copy_all</md-icon>
                        )}
                      </div>
                    </td>
                    <td>
                      {item.respondent ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img
                            src={item.respondent.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Anon'}
                            alt={item.respondent.name}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--md-sys-color-outline-variant)' }}
                          />
                          <span className="md-typescale-body-medium">{item.respondent.name || 'Anonymous'}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>—</span>
                      )}
                    </td>
                    <td>{getSentimentPill(item.sentiment)}</td>
                    <td>
                      {item.themes[0] ? (
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: 'var(--md-sys-color-primary-container)',
                          color: 'var(--md-sys-color-on-primary-container)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          textTransform: 'capitalize'
                        }}>
                          {item.themes[0]}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--md-sys-color-outline)' }}>—</span>
                      )}
                    </td>
                    <td style={{
                      maxWidth: '220px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {item.transcription}
                    </td>
                    <td>{getStatusPill(item)}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--md-sys-color-tertiary)' }}>
                      {item.rating ? `${item.rating}★` : '—'}
                    </td>
                    <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(item.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {processedData.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px'
        }}>
          <div className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            Showing {Math.min(processedData.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(processedData.length, currentPage * itemsPerPage)} of {processedData.length} records
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <md-icon-button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              <md-icon>chevron_left</md-icon>
            </md-icon-button>
            <span className="md-typescale-body-medium" style={{ fontWeight: 'bold' }}>
              Page {currentPage} of {totalPages}
            </span>
            <md-icon-button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
              <md-icon>chevron_right</md-icon>
            </md-icon-button>
          </div>
        </div>
      )}

      {/* Premium Full-Screen Feedback Detail Modal */}
      {selectedFeedback && (
        <div
          className="fb-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedFeedback(null); }}
        >
          <div className="fb-modal-card">

            {/* ── Modal Header ── */}
            <div className="fb-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {selectedFeedback.respondent?.avatarUrl ? (
                  <img
                    src={selectedFeedback.respondent.avatarUrl}
                    alt={selectedFeedback.respondent.name}
                    className="fb-modal-avatar"
                  />
                ) : (
                  <div className="fb-modal-avatar fb-modal-avatar-placeholder">
                    <md-icon>person</md-icon>
                  </div>
                )}
                <div>
                  <div className="fb-modal-name">
                    {selectedFeedback.respondent?.name || 'Anonymous'}
                  </div>
                  <div className="fb-modal-meta">
                    <md-icon style={{ fontSize: '14px', verticalAlign: 'middle' }}>schedule</md-icon>
                    {' '}{new Date(selectedFeedback.timestamp).toLocaleString()}
                    {' · '}
                    <md-icon style={{ fontSize: '14px', verticalAlign: 'middle' }}>source</md-icon>
                    {' '}{selectedFeedback.source || 'File Upload'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Carousel counter */}
                <span className="fb-modal-counter">
                  {carouselIndex + 1} / {processedDataRef.current.length}
                </span>
                {/* Prev / Next */}
                <md-icon-button
                  onClick={() => handleCarouselNav('prev')}
                  disabled={carouselIndex <= 0}
                  title="Previous record"
                >
                  <md-icon>navigate_before</md-icon>
                </md-icon-button>
                <md-icon-button
                  onClick={() => handleCarouselNav('next')}
                  disabled={carouselIndex >= processedDataRef.current.length - 1}
                  title="Next record"
                >
                  <md-icon>navigate_next</md-icon>
                </md-icon-button>
                {/* Close */}
                <md-icon-button onClick={() => setSelectedFeedback(null)} title="Close">
                  <md-icon>close</md-icon>
                </md-icon-button>
              </div>
            </div>

            {/* ── Dynamic grid columns based on image availability ── */}
            <div className="fb-modal-body" style={{
              gridTemplateColumns: selectedFeedback.scannedImage ? '280px 1.2fr 1fr' : '280px 1fr'
            }}>

              {/* LEFT – Read-only info panel */}
              <div className="fb-modal-panel fb-modal-panel-left">

                <div className="fb-modal-section-label">ID</div>
                <div className="fb-modal-id">{selectedFeedback.id}</div>

                <div className="fb-modal-section-label" style={{ marginTop: '20px' }}>Sentiment</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {(['positive', 'neutral', 'negative'] as const).map(s => (
                    <span key={s} className={`fb-pill fb-pill-${s}${editSentiment === s ? ' fb-pill-active' : ''}`}
                      onClick={() => setEditSentiment(s)} style={{ cursor: 'pointer' }}>
                      {s === 'positive' ? '😊' : s === 'negative' ? '😞' : '😐'} {s}
                    </span>
                  ))}
                </div>

                {/* Sentiment Reasoning */}
                {selectedFeedback.sentimentReasoning && (
                  <>
                    <div className="fb-modal-section-label" style={{ marginTop: '20px' }}>Why This Sentiment?</div>
                    <div className="fb-reasoning-box">
                      <TypewriterText text={selectedFeedback.sentimentReasoning} speed={18} />
                    </div>
                  </>
                )}

                {/* Keyword Analysis */}
                <div className="fb-modal-section-label" style={{ marginTop: '20px' }}>Keywords Found</div>
                <div className="fb-keywords-section">
                  {keywordAnalysis && (
                    <>
                      {/* Positive keywords */}
                      {keywordAnalysis.positive.length > 0 && (
                        <div className="fb-kw-group">
                          <span className="fb-kw-label fb-kw-label-positive">
                            <md-icon style={{ fontSize: '14px', verticalAlign: 'middle' }}>thumb_up</md-icon>
                            {' '}Positive ({keywordAnalysis.positive.length})
                          </span>
                          <div className="fb-kw-pills">
                            {keywordAnalysis.positive.map((w, i) => (
                              <span key={i} className="fb-kw-pill fb-kw-pill-positive">{w}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Negative keywords */}
                      {keywordAnalysis.negative.length > 0 && (
                        <div className="fb-kw-group">
                          <span className="fb-kw-label fb-kw-label-negative">
                            <md-icon style={{ fontSize: '14px', verticalAlign: 'middle' }}>thumb_down</md-icon>
                            {' '}Negative ({keywordAnalysis.negative.length})
                          </span>
                          <div className="fb-kw-pills">
                            {keywordAnalysis.negative.map((w, i) => (
                              <span key={i} className="fb-kw-pill fb-kw-pill-negative">{w}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Neutral keywords */}
                      {keywordAnalysis.neutral.length > 0 && (
                        <div className="fb-kw-group">
                          <span className="fb-kw-label fb-kw-label-neutral">
                            <md-icon style={{ fontSize: '14px', verticalAlign: 'middle' }}>remove</md-icon>
                            {' '}Neutral ({keywordAnalysis.neutral.length})
                          </span>
                          <div className="fb-kw-pills">
                            {keywordAnalysis.neutral.map((w, i) => (
                              <span key={i} className="fb-kw-pill fb-kw-pill-neutral">{w}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {keywordAnalysis.positive.length === 0 && keywordAnalysis.negative.length === 0 && keywordAnalysis.neutral.length === 0 && (
                        <div className="fb-kw-empty">No sentiment keywords detected</div>
                      )}

                      {/* Keyword-based reasoning */}
                      {(() => {
                        const posCount = keywordAnalysis.positive.length;
                        const negCount = keywordAnalysis.negative.length;
                        const total = posCount + negCount;
                        if (total === 0) return null;
                        const ratio = posCount / total;
                        let derivedSentiment: string;
                        let emoji: string;
                        if (ratio > 0.6) {
                          derivedSentiment = 'Positive';
                          emoji = '😊';
                        } else if (ratio < 0.4) {
                          derivedSentiment = 'Negative';
                          emoji = '😞';
                        } else {
                          derivedSentiment = 'Mixed';
                          emoji = '😐';
                        }
                        return (
                          <div className="fb-kw-reasoning">
                            {emoji} <strong>{posCount} positive</strong>{negCount > 0 && <> · <strong>{negCount} negative</strong></>} keywords → overall leans <strong>{derivedSentiment}</strong>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                <div className="fb-modal-section-label" style={{ marginTop: '20px' }}>Rating</div>
                <div className="fb-star-row">
                  {[1,2,3,4,5].map(n => (
                    <md-icon-button key={n} onClick={() => setEditRating(editRating === n ? null : n)}
                      style={{ '--md-icon-button-icon-color': n <= (editRating ?? 0) ? 'var(--md-sys-color-tertiary)' : 'var(--md-sys-color-outline)' }}>
                      <md-icon>{n <= (editRating ?? 0) ? 'star' : 'star_border'}</md-icon>
                    </md-icon-button>
                  ))}
                  <span style={{ marginLeft: '4px', color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.8rem' }}>
                    {editRating ? `${editRating} / 5` : 'No rating'}
                  </span>
                </div>

                <div className="fb-modal-section-label" style={{ marginTop: '20px' }}>Themes</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {(editThemes ? editThemes.split(',').map(t => t.trim()).filter(Boolean) : selectedFeedback.themes).map((t, i) => (
                    <span key={i} className="fb-tag">{t}</span>
                  ))}
                  {!editThemes && selectedFeedback.themes.length === 0 && <span style={{ color: 'var(--md-sys-color-outline)' }}>—</span>}
                </div>

                <div className="fb-modal-section-label" style={{ marginTop: '20px' }}>Status</div>
                <div style={{ marginTop: '6px' }}>{getStatusPill(selectedFeedback)}</div>

                <div className="fb-modal-section-label" style={{ marginTop: '20px' }}>Confidence</div>
                <div style={{ marginTop: '6px' }}>
                  <span className={`fb-tag fb-tag-conf-${selectedFeedback.confidence}`}>
                    {selectedFeedback.confidence}
                  </span>
                </div>

                {/* Summary */}
                {selectedFeedback.summary && (
                  <>
                    <div className="fb-modal-section-label" style={{ marginTop: '20px' }}>AI Summary</div>
                    <div className="fb-summary-box">
                      <TypewriterText text={selectedFeedback.summary} speed={22} />
                    </div>
                  </>
                )}
              </div>

              {/* MIDDLE – Scanned Image Panel */}
              {selectedFeedback.scannedImage && (
                <div className="fb-modal-panel fb-modal-panel-middle" style={{
                  background: 'var(--md-sys-color-surface-container-high)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderRight: '1px solid var(--md-sys-color-outline-variant)',
                  alignItems: 'center',
                  padding: '24px'
                }}>
                  <div className="fb-modal-section-label" style={{ alignSelf: 'flex-start' }}>Original Scanned Card</div>
                  <div style={{
                    width: '100%',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#000',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    position: 'relative',
                    minHeight: '300px'
                  }}>
                    <img 
                      src={selectedFeedback.scannedImage} 
                      alt="Scanned card" 
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* RIGHT – Editable fields */}
              <div className="fb-modal-panel fb-modal-panel-right">

                <div className="fb-modal-section-label">Full Transcription</div>
                
                {/* Highlighted keyword preview */}
                {keywordAnalysis && (keywordAnalysis.positive.length > 0 || keywordAnalysis.negative.length > 0 || keywordAnalysis.neutral.length > 0) && (
                  <div className="fb-kw-preview">
                    <div className="fb-kw-preview-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <md-icon style={{ fontSize: '14px', verticalAlign: 'middle' }}>visibility</md-icon>
                        {' '}Transcript Highlights
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <span 
                          onClick={() => setHighlightMode('keywords')}
                          style={{
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: highlightMode === 'keywords' ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                            color: highlightMode === 'keywords' ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)',
                            fontWeight: 'bold',
                            border: '1px solid var(--md-sys-color-outline-variant)'
                          }}
                        >
                          Keywords
                        </span>
                                                <span 
                          onClick={() => setHighlightMode('occlusion')}
                          style={{
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: highlightMode === 'occlusion' ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                            color: highlightMode === 'occlusion' ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)',
                            fontWeight: 'bold',
                            border: '1px solid var(--md-sys-color-outline-variant)'
                          }}
                        >
                          Word impact
                        </span>
                      </div>
                    </div>

                    {highlightMode === 'occlusion' && (
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', padding: '6px 8px', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: '4px', marginBottom: '8px', borderLeft: '3px solid var(--md-sys-color-primary)', flexWrap: 'wrap' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'rgba(46, 125, 50, 0.7)' }} /> Word pushes toward positive
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'rgba(211, 47, 47, 0.7)' }} /> Word pushes toward negative
                        </span>
                        <span style={{ color: 'var(--md-sys-color-outline)', fontStyle: 'italic' }}>— computed by removing each word and comparing the score</span>
                      </div>
                    )}

                    <div className="fb-kw-preview-text">
                                            {renderHighlightedText(editTranscription, keywordAnalysis, highlightMode)}
                    </div>
                  </div>
                )}

                <md-outlined-text-field
                  label="Transcription"
                  type="textarea"
                  rows={6}
                  value={editTranscription}
                  onInput={(e: any) => setEditTranscription(e.target.value)}
                  style={{ width: '100%', marginTop: '6px' }}
                />

                <div className="fb-modal-section-label" style={{ marginTop: '16px' }}>Edit Themes</div>
                <md-outlined-text-field
                  label="Themes (comma separated)"
                  value={editThemes}
                  onInput={(e: any) => setEditThemes(e.target.value)}
                  style={{ width: '100%', marginTop: '6px' }}
                />

                {/* Custom Tags Section */}
                <div className="fb-modal-section-label" style={{ marginTop: '16px' }}>Custom Tags</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                  {(selectedFeedback.tags ?? []).map(tag => (
                    <span key={tag} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem',
                      background: 'var(--md-sys-color-secondary-container)',
                      color: 'var(--md-sys-color-on-secondary-container)',
                      fontWeight: '500'
                    }}>
                      {tag}
                      <md-icon-button
                        onClick={() => removeTag(selectedFeedback.id, tag)}
                        style={{ '--md-icon-button-state-layer-size': '20px', width: '20px', height: '20px', padding: 0 }}
                      >
                        <md-icon style={{ fontSize: '12px' }}>close</md-icon>
                      </md-icon-button>
                    </span>
                  ))}
                  <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '4px' }}>
                    <md-outlined-text-field
                      placeholder="Add tag..."
                      value={newTagText}
                      onInput={(e: any) => setNewTagText(e.target.value)}
                      style={{ flex: 1, '--md-outlined-text-field-container-shape': '8px', height: '36px' }}
                    />
                    <md-filled-button
                      onClick={() => {
                        if (newTagText.trim()) {
                          addTag(selectedFeedback.id, newTagText);
                          setNewTagText('');
                        }
                      }}
                      style={{ height: '36px' }}
                    >
                      Add
                    </md-filled-button>
                  </div>
                </div>

                {/* Auto-Reply Suggestion Card */}
                <div style={{
                  marginTop: '20px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'var(--md-sys-color-surface-container-low)',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <md-icon style={{ fontSize: '18px', color: 'var(--md-sys-color-primary)' }}>assistant</md-icon>
                      AI Auto-Reply Suggestion
                    </span>
                    <md-text-button
                      disabled={isGeneratingReply}
                      onClick={async () => {
                        setIsGeneratingReply(true);
                        await generateAutoReply(selectedFeedback.id);
                        setIsGeneratingReply(false);
                      }}
                    >
                      {isGeneratingReply ? 'Generating...' : (selectedFeedback.autoReplyDraft ? 'Regenerate' : 'Generate')}
                    </md-text-button>
                  </div>
                  {selectedFeedback.autoReplyDraft ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <p className="md-typescale-body-small" style={{ margin: 0, fontStyle: 'italic', color: 'var(--md-sys-color-on-surface)' }}>
                        "{selectedFeedback.autoReplyDraft}"
                      </p>
                      <md-outlined-button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedFeedback.autoReplyDraft || '');
                          alert('Draft copied to clipboard!');
                        }}
                        style={{ alignSelf: 'flex-end', '--md-outlined-button-container-height': '32px', '--md-outlined-button-label-text-size': '0.75rem' }}
                      >
                        <md-icon slot="icon">content_copy</md-icon>
                        Copy Draft
                      </md-outlined-button>
                    </div>
                  ) : (
                    <p className="md-typescale-body-small" style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
                      No draft reply generated yet. Click generate to create one using LLM context.
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="fb-modal-actions" style={{ marginTop: '24px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <md-text-button
                      onClick={handleDeleteItem}
                      style={{ '--md-text-button-label-text-color': 'var(--sentiment-negative)', '--md-text-button-container-height': '40px' }}
                    >
                      <md-icon slot="icon">delete</md-icon>
                      Delete
                    </md-text-button>
                    <md-outlined-button
                      disabled={isReAnalyzing}
                      onClick={async () => {
                        setIsReAnalyzing(true);
                        await reAnalyzeFeedback(selectedFeedback.id);
                        // Refresh display values
                        const updated = data.find(f => f.id === selectedFeedback.id);
                        if (updated) {
                          setEditTranscription(updated.transcription);
                          setEditSentiment(updated.sentiment);
                          setEditRating(updated.rating);
                          setEditThemes(updated.themes.join(', '));
                        }
                        setIsReAnalyzing(false);
                      }}
                      style={{ '--md-outlined-button-container-height': '40px' }}
                    >
                      <md-icon slot="icon">refresh</md-icon>
                      {isReAnalyzing ? 'Re-analyzing...' : 'Re-analyze'}
                    </md-outlined-button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <md-outlined-button style={{ '--md-outlined-button-container-height': '40px', minWidth: '100px' }} onClick={() => setSelectedFeedback(null)}>Cancel</md-outlined-button>
                    <md-filled-button style={{ '--md-filled-button-container-height': '40px', minWidth: '120px' }} onClick={handleSaveDetails}>
                      <md-icon slot="icon">save</md-icon>
                      Save Changes
                    </md-filled-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sortable-header:hover {
          background-color: var(--md-sys-color-surface-container-high);
        }

        /* ── Overlay ── */
        @keyframes fb-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fb-card-in {
          from { opacity: 0; transform: translateY(32px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }

        .fb-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: fb-overlay-in var(--md-sys-motion-duration-medium1) var(--md-sys-motion-easing-standard);
        }

        .fb-modal-card {
          background: var(--md-sys-color-surface-container);
          border: 1px solid var(--md-sys-color-outline-variant);
          border-radius: 28px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.35);
          animation: fb-card-in var(--md-sys-motion-duration-long1) var(--md-sys-motion-easing-emphasized);
        }

        /* ── Header ── */
        .fb-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--md-sys-color-outline-variant);
          background: var(--md-sys-color-surface-container-high);
          flex-shrink: 0;
        }
        .fb-modal-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2px solid var(--md-sys-color-outline-variant);
          object-fit: cover;
          flex-shrink: 0;
        }
        .fb-modal-avatar-placeholder {
          background: var(--md-sys-color-primary-container);
          color: var(--md-sys-color-on-primary-container);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fb-modal-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--md-sys-color-on-surface);
          line-height: 1.3;
        }
        .fb-modal-meta {
          font-size: 0.75rem;
          color: var(--md-sys-color-on-surface-variant);
          margin-top: 2px;
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }
        .fb-modal-counter {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--md-sys-color-on-surface-variant);
          background: var(--md-sys-color-surface-container);
          border: 1px solid var(--md-sys-color-outline-variant);
          border-radius: 100px;
          padding: 3px 10px;
        }

        /* ── Body columns ── */
        .fb-modal-body {
          display: grid;
          gap: 0;
          overflow: hidden;
          flex: 1;
        }
        .fb-modal-panel {
          padding: 24px;
          overflow-y: auto;
        }
        .fb-modal-panel-left {
          background: var(--md-sys-color-surface-container-low);
          border-right: 1px solid var(--md-sys-color-outline-variant);
        }
        .fb-modal-panel-middle {
          background: var(--md-sys-color-surface-container-high);
          display: flex;
          flex-direction: column;
        }
        .fb-modal-panel-right {
          background: var(--md-sys-color-surface-container);
          display: flex;
          flex-direction: column;
        }

        .fb-modal-section-label {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--md-sys-color-primary);
          margin-bottom: 2px;
        }
        .fb-modal-id {
          font-family: 'Roboto Mono', monospace;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--md-sys-color-on-surface-variant);
          background: var(--md-sys-color-surface-container);
          padding: 4px 10px;
          border-radius: 6px;
          display: inline-block;
          border: 1px solid var(--md-sys-color-outline-variant);
        }

        /* ── Sentiment pills (clickable in modal) ── */
        .fb-pill {
          padding: 5px 14px;
          border-radius: 100px;
          font-size: 0.78rem;
          font-weight: 600;
          text-transform: capitalize;
          border: 2px solid transparent;
          transition: all var(--md-sys-motion-duration-medium1) var(--md-sys-motion-easing-emphasized);
          user-select: none;
        }
        .fb-pill-positive  { background: var(--sentiment-positive-container);  color: var(--sentiment-positive-on-container); }
        .fb-pill-neutral   { background: var(--sentiment-neutral-container);   color: var(--sentiment-neutral-on-container); }
        .fb-pill-negative  { background: var(--sentiment-negative-container);  color: var(--sentiment-negative-on-container); }
        .fb-pill-active    { border-color: var(--md-sys-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent); transform: scale(1.05); }

        /* ── Star row ── */
        .fb-star-row {
          display: flex;
          align-items: center;
          gap: 0;
          margin-top: 4px;
        }

        /* ── Tags ── */
        .fb-tag {
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 0.73rem;
          font-weight: 600;
          text-transform: capitalize;
          background: var(--md-sys-color-primary-container);
          color: var(--md-sys-color-on-primary-container);
        }
        .fb-tag-conf-high   { background: var(--sentiment-positive-container); color: var(--sentiment-positive-on-container); }
        .fb-tag-conf-medium { background: var(--sentiment-neutral-container);  color: var(--sentiment-neutral-on-container); }
        .fb-tag-conf-low    { background: var(--sentiment-negative-container); color: var(--sentiment-negative-on-container); }

        /* ── Keyword Analysis Section ── */
        .fb-keywords-section {
          margin-top: 6px;
        }
        .fb-kw-group {
          margin-bottom: 8px;
        }
        .fb-kw-label {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          margin-bottom: 4px;
        }
        .fb-kw-label-positive { color: var(--sentiment-positive-on-container); }
        .fb-kw-label-negative { color: var(--sentiment-negative-on-container); }
        .fb-kw-label-neutral  { color: var(--md-sys-color-on-surface-variant); }
        .fb-kw-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .fb-kw-pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 500;
        }
        .fb-kw-pill-positive { background: var(--sentiment-positive-container); color: var(--sentiment-positive-on-container); }
        .fb-kw-pill-negative { background: var(--sentiment-negative-container); color: var(--sentiment-negative-on-container); }
        .fb-kw-pill-neutral  { background: var(--md-sys-color-surface-container-high); color: var(--md-sys-color-on-surface-variant); }
        .fb-kw-empty {
          font-size: 0.75rem;
          color: var(--md-sys-color-outline);
          font-style: italic;
        }
        .fb-kw-reasoning {
          margin-top: 8px;
          padding: 6px 10px;
          background: var(--md-sys-color-surface-container);
          border-radius: 8px;
          font-size: 0.75rem;
          line-height: 1.4;
          color: var(--md-sys-color-on-surface);
          border: 1px solid var(--md-sys-color-outline-variant);
        }

        /* ── Highlighted Keyword Preview ── */
        .fb-kw-preview {
          margin-top: 6px;
          margin-bottom: 12px;
          background: var(--md-sys-color-surface);
          border: 1px solid var(--md-sys-color-outline-variant);
          border-radius: 8px;
          padding: 10px 12px;
        }
        .fb-kw-preview-label {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--md-sys-color-tertiary);
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .fb-kw-preview-text {
          font-size: 0.85rem;
          line-height: 1.7;
          color: var(--md-sys-color-on-surface);
          white-space: pre-wrap;
          word-break: break-word;
        }
        mark.kw-highlight {
          padding: 1px 2px;
          border-radius: 3px;
        }
        mark.kw-positive {
          background: color-mix(in srgb, var(--sentiment-positive-container) 70%, transparent);
          color: var(--sentiment-positive-on-container);
          border-bottom: 2px solid var(--sentiment-positive);
        }
        mark.kw-negative {
          background: color-mix(in srgb, var(--sentiment-negative-container) 70%, transparent);
          color: var(--sentiment-negative-on-container);
          border-bottom: 2px solid var(--sentiment-negative);
        }
        mark.kw-neutral {
          background: color-mix(in srgb, var(--md-sys-color-surface-container-high) 70%, transparent);
          color: var(--md-sys-color-on-surface-variant);
          border-bottom: 2px solid var(--md-sys-color-outline);
        }

        /* ── Typewriter Effect ── */
        .typewriter-text {
          display: inline;
        }
        .typewriter-cursor {
          display: inline-block;
          width: 2px;
          height: 1em;
          background-color: var(--md-sys-color-primary);
          margin-left: 1px;
          vertical-align: text-bottom;
          animation: typewriter-blink 0.8s step-end infinite;
        }
        @keyframes typewriter-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        /* ── Sentiment Reasoning box ── */
        .fb-reasoning-box {
          background: var(--md-sys-color-surface-container);
          border: 1px solid var(--md-sys-color-outline-variant);
          border-left: 4px solid var(--md-sys-color-tertiary);
          border-radius: 0 8px 8px 0;
          padding: 10px 14px;
          font-size: 0.82rem;
          line-height: 1.55;
          color: var(--md-sys-color-on-surface);
          margin-top: 6px;
          max-height: 100px;
          overflow-y: auto;
        }

        /* ── AI Summary box ── */
        .fb-summary-box {
          background: var(--md-sys-color-surface-container);
          border: 1px solid var(--md-sys-color-outline-variant);
          border-left: 4px solid var(--md-sys-color-primary);
          border-radius: 0 8px 8px 0;
          padding: 10px 14px;
          font-size: 0.82rem;
          line-height: 1.55;
          color: var(--md-sys-color-on-surface);
          margin-top: 6px;
          font-style: italic;
        }

        /* ── Actions row at bottom of right panel ── */
        .fb-modal-actions {
          margin-top: auto;
          padding-top: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--md-sys-color-outline-variant);
        }

        /* ── Responsive: stack on small screens ── */
        @media (max-width: 900px) {
          .fb-modal-body {
            grid-template-columns: 1fr !important;
          }
          .fb-modal-panel-left {
            border-right: none;
            border-bottom: 1px solid var(--md-sys-color-outline-variant);
          }
          .fb-modal-panel-middle {
            border-right: none;
            border-bottom: 1px solid var(--md-sys-color-outline-variant);
          }
        }
      `}</style>
    </div>
  );
}
