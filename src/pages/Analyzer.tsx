import React, { useRef, useState } from 'react';
import { extractPdfPages } from '../utils/pdfExtractor';
import { QueueItem, FeedbackRecord } from '../types';
import '@material/web/button/filled-button.js';
import '@material/web/button/text-button.js';
import '@material/web/progress/linear-progress.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/dialog/dialog.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';

interface AnalyzerProps {
  queue: QueueItem[];
  isProcessing: boolean;
  addToQueue: (files: File[]) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  analyzeBatch: () => void;
  addFeedback: (item: Omit<FeedbackRecord, 'id' | 'timestamp'>) => void;
  updateFeedback: (id: string, updatedFields: Partial<FeedbackRecord>) => void;
}

export default function Analyzer({
  queue,
  isProcessing,
  addToQueue,
  removeFromQueue,
  clearQueue,
  analyzeBatch,
  addFeedback,
  updateFeedback
}: AnalyzerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<'image' | 'pdf'>('image');
  const [selectedReviewItem, setSelectedReviewItem] = useState<QueueItem | null>(null);
  
  // Temporary edit states for manual validation dialog
  const [editTranscription, setEditTranscription] = useState('');
  const [editSentiment, setEditSentiment] = useState<'positive' | 'neutral' | 'negative'>('neutral');
  const [editRating, setEditRating] = useState<number | null>(null);
  const [editThemes, setEditThemes] = useState('');

  // Desktop webcam capture states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Failed to open camera:', err);
      alert('Could not access camera. Please check permissions.');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const captureFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `camera_capture_${Date.now()}.png`, { type: 'image/png' });
            addToQueue([file]);
          }
        }, 'image/png');
      }
      stopCamera();
    }
  };

  /** Extract pages from PDF files, pass through non-PDF files as-is */
  const processFiles = async (files: File[]): Promise<File[]> => {
    const items: File[] = [];
    for (const file of files) {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const pages = await extractPdfPages(file);
          pages.forEach(p => items.push(p.file));
        } catch (err) {
          console.error('PDF extraction failed for', file.name, err);
        }
      } else {
        items.push(file);
      }
    }
    return items;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const items = await processFiles(Array.from(e.target.files));
      if (items.length > 0) addToQueue(items);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      // Filter based on active mode
      const filtered = uploadMode === 'pdf'
        ? files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
        : files.filter(f => f.type.startsWith('image/'));
      
      if (filtered.length > 0) {
        const items = await processFiles(filtered);
        if (items.length > 0) addToQueue(items);
      }
    }
  };

  // Clipboard paste listener
  React.useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            imageFiles.push(new File([blob], `clipboard_image_${Date.now()}_${i}.png`, { type: blob.type }));
          }
        }
      }
      if (imageFiles.length > 0) {
        addToQueue(imageFiles);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addToQueue]);

  const openReviewDialog = (item: QueueItem) => {
    if (!item.result) return;
    setSelectedReviewItem(item);
    setEditTranscription(item.result.transcription);
    setEditSentiment(item.result.sentiment);
    setEditRating(item.result.rating);
    setEditThemes(item.result.themes.join(', '));
  };

  const handleSaveReview = () => {
    if (!selectedReviewItem || !selectedReviewItem.result) return;
    
    const themesList = editThemes
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const editedResult: Omit<FeedbackRecord, 'id' | 'timestamp'> = {
      ...selectedReviewItem.result,
      transcription: editTranscription,
      sentiment: editSentiment,
      rating: editRating,
      themes: themesList,
      needsReview: false,
      reviewedAndEdited: true
    };

    // Save to the database
    addFeedback(editedResult);
    
    // Remove from active queue
    removeFromQueue(selectedReviewItem.id);
    setSelectedReviewItem(null);
  };

  const getStatusChip = (status: QueueItem['status'], confidence?: string) => {
    const chipStyles: Record<string, { bg: string, fg: string, label: string }> = {
      queued: { bg: 'var(--md-sys-color-surface-container-high)', fg: 'var(--md-sys-color-on-surface-variant)', label: 'Queued' },
      reading: { bg: 'var(--md-sys-color-primary-container)', fg: 'var(--md-sys-color-on-primary-container)', label: 'Reading...' },
      done: { bg: 'var(--sentiment-positive-container)', fg: 'var(--sentiment-positive-on-container)', label: confidence === 'low' ? 'Needs Review' : 'Success' },
      failed: { bg: 'var(--sentiment-negative-container)', fg: 'var(--sentiment-negative-on-container)', label: 'Failed' }
    };
    
    const current = chipStyles[status];
    if (status === 'done' && confidence === 'low') {
      current.bg = 'var(--sentiment-neutral-container)';
      current.fg = 'var(--sentiment-neutral-on-container)';
    }

    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '0.7rem',
        fontWeight: 'bold',
        backgroundColor: current.bg,
        color: current.fg,
        display: 'inline-block'
      }}>
        {current.label}
      </span>
    );
  };

  const activeUploadsCount = queue.length;
  const processedCount = queue.filter(q => q.status === 'done').length;
  const overallProgress = activeUploadsCount > 0 ? Math.round((processedCount / activeUploadsCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
      
      {/* Mode Toggle Tabs */}
      <div className="m3-entrance-up m3-stagger-1" style={{
        display: 'flex',
        gap: '4px',
        backgroundColor: 'var(--md-sys-color-surface-container)',
        borderRadius: '12px',
        padding: '4px',
        width: 'fit-content'
      }}      >
        <button
          onClick={() => setUploadMode('image')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: uploadMode === 'image' ? 'var(--md-sys-color-primary)' : 'transparent',
            color: uploadMode === 'image' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            fontFamily: 'var(--md-ref-typeface-plain)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
          }}
        >
          <span style={{ fontSize: '18px' }}>📷</span>
          Scan Image
        </button>
        <button
          onClick={() => setUploadMode('pdf')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: uploadMode === 'pdf' ? 'var(--md-sys-color-primary)' : 'transparent',
            color: uploadMode === 'pdf' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            fontFamily: 'var(--md-ref-typeface-plain)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
          }}
        >
          <span style={{ fontSize: '18px' }}>📄</span>
          PDF Upload
        </button>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          border: '2px dashed var(--md-sys-color-outline)',
          borderRadius: '16px',
          padding: '40px 24px',
          textAlign: 'center',
          backgroundColor: 'var(--md-sys-color-surface)',
          cursor: 'pointer',
          transition: 'all var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
        }}
        onClick={() => {
          if (uploadMode === 'pdf') pdfInputRef.current?.click();
          else fileInputRef.current?.click();
        }}
        className="upload-dropzone m3-entrance-up m3-stagger-2"
      >
        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <input
          type="file"
          ref={pdfInputRef}
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {uploadMode === 'image' ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
            <h3 className="md-typescale-title-large" style={{ marginBottom: '8px' }}>
              Drag and drop customer cards here
            </h3>
            <p className="md-typescale-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '20px' }}>
              Supports JPG, PNG formats containing handwritten text.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <md-filled-button style={{ '--md-filled-button-container-height': '48px', '--md-filled-button-label-text-size': '0.9375rem', '--md-filled-button-leading-space': '32px', '--md-filled-button-trailing-space': '32px', '--md-filled-button-with-leading-icon-leading-space': '24px', '--md-filled-button-with-leading-icon-trailing-space': '28px', minWidth: '200px' }} onClick={(e: any) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <md-icon slot="icon">cloud_upload</md-icon>
                Choose Images
              </md-filled-button>
              <md-outlined-button style={{ '--md-outlined-button-container-height': '48px', '--md-outlined-button-label-text-size': '0.9375rem', '--md-outlined-button-leading-space': '28px', '--md-outlined-button-trailing-space': '28px', '--md-outlined-button-with-leading-icon-leading-space': '20px', '--md-outlined-button-with-leading-icon-trailing-space': '24px' }} onClick={(e: any) => { e.stopPropagation(); startCamera(); }}>
                <md-icon slot="icon">photo_camera</md-icon>
                Camera Capture
              </md-outlined-button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <h3 className="md-typescale-title-large" style={{ marginBottom: '8px' }}>
              Drop a PDF file to analyze
            </h3>
            <p className="md-typescale-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '20px' }}>
              Upload PDF documents containing handwritten feedback cards, forms, or surveys.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <md-filled-button style={{ '--md-filled-button-container-height': '48px', '--md-filled-button-label-text-size': '0.9375rem', '--md-filled-button-leading-space': '32px', '--md-filled-button-trailing-space': '32px', '--md-filled-button-with-leading-icon-leading-space': '24px', '--md-filled-button-with-leading-icon-trailing-space': '28px' }} onClick={(e: any) => { e.stopPropagation(); pdfInputRef.current?.click(); }}>
                <md-icon slot="icon">description</md-icon>
                Choose PDF
              </md-filled-button>
            </div>
          </>
        )}
      </div>

      {/* Batch Action Bar */}
      {queue.length > 0 && (
        <div style={{
          border: '1px solid var(--md-sys-color-outline-variant)',
          borderRadius: '16px',
          backgroundColor: 'var(--md-sys-color-surface)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="md-typescale-body-medium">
              Batch Queue: <span style={{ fontWeight: 'bold' }}>{queue.length} items</span> ({processedCount} analyzed)
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <md-text-button onClick={clearQueue} disabled={isProcessing}>
                Clear Queue
              </md-text-button>
              <md-filled-button onClick={analyzeBatch} disabled={isProcessing || processedCount === queue.length}>
                <md-icon slot="icon">play_arrow</md-icon>
                Analyze Batch
              </md-filled-button>
            </div>
          </div>

          <md-linear-progress value={overallProgress / 100} style={{ width: '100%' }} />
        </div>
      )}

      {/* Queue Grid */}
      {queue.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {queue.map(item => (
            <div
              key={item.id}
              style={{
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '12px',
                backgroundColor: 'var(--md-sys-color-surface)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: '180px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', padding: '12px', gap: '12px', flex: 1 }}>
                {/* Thumbnail */}
                <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                  <img
                    src={item.objectUrl}
                    alt={item.fileName}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      border: '1px solid var(--md-sys-color-outline-variant)'
                    }}
                  />
                  {/* File type badge */}
                  <span style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    fontSize: '0.55rem',
                    fontWeight: 'bold',
                    lineHeight: 1,
                    backgroundColor: item.fileName.match(/ - Page \d+\.png$/)
                      ? 'var(--md-sys-color-tertiary-container)'
                      : 'var(--md-sys-color-secondary-container)',
                    color: item.fileName.match(/ - Page \d+\.png$/)
                      ? 'var(--md-sys-color-on-tertiary-container)'
                      : 'var(--md-sys-color-on-secondary-container)',
                    border: '2px solid var(--md-sys-color-surface)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  >
                    {item.fileName.match(/ - Page \d+\.png$/) ? 'PDF' : 'IMG'}
                  </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="md-typescale-body-medium" style={{
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.fileName}
                  </div>
                  <div className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '8px' }}>
                    {Math.round(item.fileSize / 1024)} KB
                  </div>
                  {getStatusChip(item.status, item.result?.confidence)}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <md-icon-button onClick={() => removeFromQueue(item.id)} disabled={isProcessing}>
                    <md-icon style={{ fontSize: '18px' }}>close</md-icon>
                  </md-icon-button>
                </div>
              </div>

              {/* Status / Transcription Preview footer inside card */}
              <div style={{
                backgroundColor: 'var(--md-sys-color-surface-container)',
                padding: '10px 12px',
                fontSize: '0.75rem',
                borderTop: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '48px'
              }}>
                {item.status === 'reading' && (
                  <div style={{ width: '100%' }}>
                    <md-linear-progress value={item.progress / 100} style={{ width: '100%' }} />
                  </div>
                )}

                {item.status === 'done' && (
                  <>
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      maxWidth: '80%'
                    }}>
                      {item.transcriptionPreview || 'Transcription complete'}
                    </span>
                    {item.result?.confidence === 'low' && (
                      <md-text-button onClick={() => openReviewDialog(item)} style={{ '--md-text-button-container-height': '36px', '--md-text-button-label-text-size': '0.8rem', '--md-text-button-leading-space': '16px', '--md-text-button-trailing-space': '16px' }}>
                        Review
                      </md-text-button>
                    )}
                  </>
                )}

                {item.status === 'failed' && (
                  <span style={{ color: 'var(--sentiment-negative)', fontWeight: 'bold' }}>
                    {item.error || 'Failed to read card'}
                  </span>
                )}

                {item.status === 'queued' && (
                  <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Ready to analyze
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual OCR Verification Dialog */}
      {selectedReviewItem && selectedReviewItem.result && (
        <md-dialog
          open={!!selectedReviewItem}
          onClose={() => setSelectedReviewItem(null)}
          style={{ maxWidth: '600px', width: '90%' }}
        >
          <div slot="headline">Manual Transcription Verification</div>
          
          <div slot="content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '8px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <img
                src={selectedReviewItem.objectUrl}
                alt="Source card"
                style={{
                  width: '100%',
                  maxHeight: '180px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}
              />
            </div>

            <md-outlined-text-field
              label="Transcribed Handwriting text"
              type="textarea"
              rows={3}
              value={editTranscription}
              onInput={(e: any) => setEditTranscription(e.target.value)}
              style={{ width: '100%' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <md-outlined-select
                label="Sentiment Rating"
                value={editSentiment}
                onClose={(e: any) => setEditSentiment(e.target.value)}
                style={{ width: '100%' }}
              >
                <md-select-option value="positive"><div slot="headline">Positive</div></md-select-option>
                <md-select-option value="neutral"><div slot="headline">Neutral</div></md-select-option>
                <md-select-option value="negative"><div slot="headline">Negative</div></md-select-option>
              </md-outlined-select>

              <md-outlined-select
                label="Assigned Stars (1-5)"
                value={editRating === null ? '' : String(editRating)}
                onClose={(e: any) => {
                  const val = e.target.value;
                  setEditRating(val === '' ? null : Number(val));
                }}
                style={{ width: '100%' }}
              >
                <md-select-option value=""><div slot="headline">No Rating</div></md-select-option>
                <md-select-option value="1"><div slot="headline">1 Star</div></md-select-option>
                <md-select-option value="2"><div slot="headline">2 Stars</div></md-select-option>
                <md-select-option value="3"><div slot="headline">3 Stars</div></md-select-option>
                <md-select-option value="4"><div slot="headline">4 Stars</div></md-select-option>
                <md-select-option value="5"><div slot="headline">5 Stars</div></md-select-option>
              </md-outlined-select>
            </div>

            <md-outlined-text-field
              label="Extracted Themes (comma separated)"
              value={editThemes}
              onInput={(e: any) => setEditThemes(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div slot="actions" style={{ display: 'flex', gap: '8px' }}>
            <md-outlined-button onClick={() => setSelectedReviewItem(null)}>Cancel</md-outlined-button>
            <md-filled-button onClick={handleSaveReview}>Approve & Save</md-filled-button>
          </div>
        </md-dialog>
      )}

      {/* Inline Webcam Capture Modal */}
      {isCameraOpen && (
        <md-dialog open onClose={stopCamera} style={{ minWidth: '320px', maxWidth: '560px' }}>
          <div slot="headline">Capture Feedback Card</div>
          <div slot="content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                maxHeight: '340px',
                borderRadius: '8px',
                background: '#000',
                objectFit: 'cover'
              }}
            />
            <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', textAlign: 'center', margin: 0 }}>
              Align the feedback handwritten card in the camera frame.
            </p>
          </div>
          <div slot="actions" style={{ display: 'flex', gap: '8px' }}>
            <md-outlined-button onClick={stopCamera}>Cancel</md-outlined-button>
            <md-filled-button onClick={captureFrame}>
              <md-icon slot="icon">photo_camera</md-icon>
              Capture Photo
            </md-filled-button>
          </div>
        </md-dialog>
      )}

      <style>{`
        .upload-dropzone:hover {
          border-color: var(--md-sys-color-primary) !important;
          background-color: var(--md-sys-color-surface-container-low) !important;
        }
        @media (min-width: 721px) {
          .mobile-only-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}
