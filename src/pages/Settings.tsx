import React, { useRef } from 'react';
import { AppSettings, FeedbackRecord } from '../types';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/switch/switch.js';
import '@material/web/icon/icon.js';

interface SettingsProps {
  settings: AppSettings;
  saveSettings: (settings: AppSettings) => void;
  clearAllData: () => void;
  loadSampleData: () => void;
  feedbackList: FeedbackRecord[];
}

export default function Settings({
  settings,
  saveSettings,
  clearAllData,
  loadSampleData,
  feedbackList
}: SettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApiKeyChange = (e: any) => {
    saveSettings({ ...settings, groqApiKey: e.target.value });
  };

  const handleModelChange = (e: any) => {
    saveSettings({ ...settings, groqModel: e.target.value });
  };

  const handleGeminiApiKeyChange = (e: any) => {
    saveSettings({ ...settings, geminiApiKey: e.target.value });
  };

  const handleGeminiModelChange = (e: any) => {
    saveSettings({ ...settings, geminiModel: e.target.value });
  };

  const handleProviderSwitch = (provider: 'groq' | 'gemini' | 'ocr' | 'mistral') => {
    saveSettings({ ...settings, apiProvider: provider });
  };

  const handleOcrSpaceApiKeyChange = (e: any) => {
    saveSettings({ ...settings, ocrSpaceApiKey: e.target.value });
  };

  const handleMistralApiKeyChange = (e: any) => {
    saveSettings({ ...settings, mistralApiKey: e.target.value });
  };

  const handleDateRangeChange = (e: any) => {
    saveSettings({ ...settings, defaultDateRange: e.target.value });
  };

  const handleDarkModeToggle = () => {
    const newDarkMode = !settings.darkMode;
    saveSettings({ ...settings, darkMode: newDarkMode });
    
    // Toggle dark class on document element immediately
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Export full JSON backup
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(feedbackList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `feedback_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  // Import JSON backup
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            // Overwrite feedback localstorage directly or invoke a store setter
            localStorage.setItem('feedback_dashboard_items', JSON.stringify(parsed));
            alert('Database imported successfully! Refreshing page...');
            window.location.reload();
          } else {
            alert('Invalid backup file. Must be a JSON array of feedback records.');
          }
        } catch (err) {
          alert('Error parsing JSON backup file.');
        }
      };
      fileReader.readAsText(e.target.files[0]);
    }
  };

  const handleClearData = () => {
    if (window.confirm('Are you absolutely sure you want to clear the feedback database? This cannot be undone.')) {
      clearAllData();
      alert('Database cleared.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
      
      {/* OCR Model configuration */}
      <div className="settings-card m3-entrance-up m3-stagger-1">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <md-icon style={{ color: 'var(--md-sys-color-primary)' }}>smart_toy</md-icon>
          <h2 className="settings-title">Vision AI Provider</h2>
        </div>

        <p className="md-typescale-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '20px', lineHeight: 1.5 }}>
          Choose which AI provider powers the handwriting OCR and sentiment analysis. Both require a valid API key — no offline fallback is available.
        </p>

        {/* Provider Switcher */}
        <div className="provider-switcher" style={{ marginBottom: '24px' }}>
          <button
            className={`provider-tab ${settings.apiProvider === 'groq' ? 'provider-tab--active' : ''}`}
            onClick={() => handleProviderSwitch('groq')}
            id="provider-tab-groq"
          >
            <span className="provider-tab-icon">⚡</span>
            <span className="provider-tab-label">Groq Cloud</span>
            <span className="provider-tab-badge">Ultra-fast LPU</span>
          </button>
          <button
            className={`provider-tab ${settings.apiProvider === 'gemini' ? 'provider-tab--active' : ''}`}
            onClick={() => handleProviderSwitch('gemini')}
            id="provider-tab-gemini"
          >
            <span className="provider-tab-icon">✦</span>
            <span className="provider-tab-label">Google Gemini</span>
            <span className="provider-tab-badge">Flash 3</span>
          </button>
          <button
            className={`provider-tab ${settings.apiProvider === 'ocr' ? 'provider-tab--active' : ''}`}
            onClick={() => handleProviderSwitch('ocr')}
            id="provider-tab-ocr"
          >
            <span className="provider-tab-icon">🔍</span>
            <span className="provider-tab-label">OCR.space</span>
            <span className="provider-tab-badge">Handwriting</span>
          </button>
          <button
            className={`provider-tab ${settings.apiProvider === 'mistral' ? 'provider-tab--active' : ''}`}
            onClick={() => handleProviderSwitch('mistral')}
            id="provider-tab-mistral"
          >
            <span className="provider-tab-icon">🍊</span>
            <span className="provider-tab-label">Mistral OCR</span>
            <span className="provider-tab-badge">Premium OCR</span>
          </button>
        </div>

        {/* Groq Panel */}
        {settings.apiProvider === 'groq' && (
          <div className="provider-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
              <md-icon style={{ color: 'var(--md-sys-color-primary)', marginTop: '2px', fontSize: '20px' }}>info</md-icon>
              <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', margin: 0, lineHeight: 1.6 }}>
                Groq uses its LPU inference engine for <strong>ultra-fast</strong> vision analysis with Llama 4 models. Get your free key at <strong>console.groq.com</strong>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <md-filled-button
                onClick={() => window.open('https://console.groq.com/keys', '_blank', 'noopener')}
                style={{ '--md-filled-button-container-height': '40px', '--md-filled-button-label-text-size': '0.875rem' }}
              >
                <md-icon slot="icon">key</md-icon>
                Get Groq API Key
              </md-filled-button>
            </div>
            <md-outlined-text-field
              label="Groq API Key"
              type="password"
              value={settings.groqApiKey}
              onInput={handleApiKeyChange}
              placeholder="gsk_..."
              style={{ width: '100%' }}
            />
            <md-outlined-select
              label="Groq Model"
              value={settings.groqModel}
              onClose={handleModelChange}
              style={{ width: '100%' }}
            >
              <md-select-option value="meta-llama/llama-4-scout-17b-16e-instruct"><div slot="headline">Llama 4 Scout (Vision, Recommended)</div></md-select-option>
              <md-select-option value="qwen/qwen3.6-27b"><div slot="headline">Qwen 3.6 27B (Vision, Thorough)</div></md-select-option>
            </md-outlined-select>
          </div>
        )}

        {/* Gemini Panel */}
        {settings.apiProvider === 'gemini' && (
          <div className="provider-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
              <md-icon style={{ color: '#4285F4', marginTop: '2px', fontSize: '20px' }}>auto_awesome</md-icon>
              <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', margin: 0, lineHeight: 1.6 }}>
                Google Gemini 2.5 Flash offers <strong>excellent handwriting OCR</strong> with native multimodal understanding. Get your free key at <strong>aistudio.google.com</strong>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <md-filled-button
                onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank', 'noopener')}
                style={{ '--md-filled-button-container-height': '40px', '--md-filled-button-label-text-size': '0.875rem', '--md-filled-button-container-color': '#4285F4' }}
              >
                <md-icon slot="icon">key</md-icon>
                Get Gemini API Key
              </md-filled-button>
            </div>
            <md-outlined-text-field
              label="Gemini API Key"
              type="password"
              value={settings.geminiApiKey}
              onInput={handleGeminiApiKeyChange}
              placeholder="AIza..."
              style={{ width: '100%' }}
            />
            <md-outlined-select
              label="Gemini Model"
              value={settings.geminiModel}
              onClose={handleGeminiModelChange}
              style={{ width: '100%' }}
            >
              <md-select-option value="gemini-3-flash"><div slot="headline">Gemini 3 Flash (Recommended, Fast)</div></md-select-option>
              <md-select-option value="gemini-2.5-pro"><div slot="headline">Gemini 2.5 Pro (Most Accurate)</div></md-select-option>
              <md-select-option value="gemini-2.5-flash"><div slot="headline">Gemini 2.5 Flash</div></md-select-option>
              <md-select-option value="gemini-2.0-flash"><div slot="headline">Gemini 2.0 Flash (Lightweight)</div></md-select-option>
            </md-outlined-select>
          </div>
        )}

        {/* OCR.space Panel */}
        {settings.apiProvider === 'ocr' && (
          <div className="provider-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
              <md-icon style={{ color: '#E67E22', marginTop: '2px', fontSize: '20px' }}>document_scanner</md-icon>
              <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', margin: 0, lineHeight: 1.6 }}>
                OCR.space uses <strong>Engine 2</strong> (handwriting-optimised) to extract text from your images. Sentiment, themes, and summaries are derived locally — <strong>no second API key required</strong>. Free tier allows up to 500 requests/month.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <md-filled-button
                onClick={() => window.open('https://ocr.space/ocrapi', '_blank', 'noopener')}
                style={{ '--md-filled-button-container-height': '40px', '--md-filled-button-label-text-size': '0.875rem', '--md-filled-button-container-color': '#E67E22' }}
              >
                <md-icon slot="icon">key</md-icon>
                Get OCR.space Free Key
              </md-filled-button>
            </div>
            <md-outlined-text-field
              label="OCR.space API Key"
              type="password"
              value={settings.ocrSpaceApiKey}
              onInput={handleOcrSpaceApiKeyChange}
              placeholder="helloworld (free demo) or your key..."
              style={{ width: '100%' }}
            />
            <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'color-mix(in srgb, #E67E22 10%, transparent)', border: '1px solid color-mix(in srgb, #E67E22 30%, transparent)' }}>
              <p className="md-typescale-body-small" style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
                💡 <strong>Quick test:</strong> Use the free demo key <code style={{ background: 'var(--md-sys-color-surface-container)', padding: '1px 5px', borderRadius: '4px' }}>helloworld</code> to try it out immediately (limited requests).
              </p>
            </div>
          </div>
        )}

        {/* Mistral OCR Panel */}
        {settings.apiProvider === 'mistral' && (
          <div className="provider-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
              <md-icon style={{ color: '#F39C12', marginTop: '2px', fontSize: '20px' }}>auto_stories</md-icon>
              <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', margin: 0, lineHeight: 1.6 }}>
                Mistral OCR delivers <strong>state-of-the-art document layout parsing</strong> and text extraction. Sentiment, themes, and summaries are derived locally. Get your API key at <strong>console.mistral.ai</strong>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <md-filled-button
                onClick={() => window.open('https://console.mistral.ai/api-keys', '_blank', 'noopener')}
                style={{ '--md-filled-button-container-height': '40px', '--md-filled-button-label-text-size': '0.875rem', '--md-filled-button-container-color': '#F39C12' }}
              >
                <md-icon slot="icon">key</md-icon>
                Get Mistral API Key
              </md-filled-button>
            </div>
            <md-outlined-text-field
              label="Mistral API Key"
              type="password"
              value={settings.mistralApiKey || ''}
              onInput={handleMistralApiKeyChange}
              placeholder="Provide your Mistral API Key..."
              style={{ width: '100%' }}
            />
          </div>
        )}

        {/* Date Range — always visible */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
          <md-outlined-select
            label="Default Date Range"
            value={settings.defaultDateRange}
            onClose={handleDateRangeChange}
            style={{ width: '100%' }}
          >
            <md-select-option value="all"><div slot="headline">All Time</div></md-select-option>
            <md-select-option value="7d"><div slot="headline">Last 7 Days</div></md-select-option>
            <md-select-option value="30d"><div slot="headline">Last 30 Days</div></md-select-option>
            <md-select-option value="90d"><div slot="headline">Last 90 Days</div></md-select-option>
          </md-outlined-select>
        </div>
      </div>

      {/* Theme Options */}
      <div className="settings-card m3-entrance-up m3-stagger-2">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <md-icon style={{ color: 'var(--md-sys-color-primary)' }}>palette</md-icon>
          <h2 className="settings-title">Display Settings</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="md-typescale-body-large" style={{ fontWeight: 'bold' }}>Dark Theme</div>
            <div className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              Enable warm dark mode theme for low-light environments
            </div>
          </div>
          <md-switch
            checked={settings.darkMode}
            onClick={handleDarkModeToggle}
          />
        </div>
      </div>

      {/* Database actions */}
      <div className="settings-card m3-entrance-up m3-stagger-3">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <md-icon style={{ color: 'var(--md-sys-color-primary)' }}>database</md-icon>
          <h2 className="settings-title">Data Backup & Recovery</h2>
        </div>

        <p className="md-typescale-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '20px' }}>
          Back up your local handwriting database, import previously saved sessions, or clear databases.
        </p>

        <div className="settings-buttons" style={{ 
          display: 'flex', 
          gap: '12px', 
          flexWrap: 'wrap', 
          alignItems: 'center',
          '--md-filled-button-container-height': '56px',
          '--md-filled-button-label-text-size': '1rem',
          '--md-filled-button-leading-space': '44px',
          '--md-filled-button-trailing-space': '44px',
          '--md-filled-button-with-leading-icon-leading-space': '32px',
          '--md-filled-button-with-leading-icon-trailing-space': '44px',
          '--md-outlined-button-container-height': '56px',
          '--md-outlined-button-label-text-size': '1rem',
          '--md-outlined-button-leading-space': '44px',
          '--md-outlined-button-trailing-space': '44px',
          '--md-outlined-button-with-leading-icon-leading-space': '32px',
          '--md-outlined-button-with-leading-icon-trailing-space': '44px',
          '--md-text-button-container-height': '56px',
          '--md-text-button-label-text-size': '1rem',
          '--md-text-button-leading-space': '32px',
          '--md-text-button-trailing-space': '32px',
          '--md-text-button-with-leading-icon-leading-space': '28px',
          '--md-text-button-with-leading-icon-trailing-space': '32px'
        } as React.CSSProperties}>
          <md-outlined-button className="settings-btn" onClick={handleExportJSON}>
            <md-icon slot="icon">download</md-icon>
            Export Backup JSON
          </md-outlined-button>

          <md-outlined-button className="settings-btn" onClick={() => {
            import('../utils/csvExport').then(m => m.exportToCSV(feedbackList));
          }}>
            <md-icon slot="icon">table_view</md-icon>
            Export Backup CSV
          </md-outlined-button>

          <md-outlined-button className="settings-btn" onClick={() => fileInputRef.current?.click()}>
            <md-icon slot="icon">upload</md-icon>
            Import Backup JSON
          </md-outlined-button>
          
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImportJSON}
            style={{ display: 'none' }}
          />

          <md-text-button className="settings-btn" onClick={loadSampleData}>
            <md-icon slot="icon">science</md-icon>
            Load Sample Test Data
          </md-text-button>

          <md-filled-button 
            className="settings-btn settings-btn--danger"
            onClick={handleClearData}
            style={{ 
              '--md-filled-button-container-color': 'var(--sentiment-negative)', 
              '--md-filled-button-label-text-color': '#fff',
            }}
          >
            <md-icon slot="icon">delete_forever</md-icon>
            Clear Database
          </md-filled-button>
        </div>
      </div>

      {/* Alert settings */}
      <div className="settings-card m3-entrance-up m3-stagger-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <md-icon style={{ color: 'var(--md-sys-color-primary)' }}>notifications_active</md-icon>
          <h2 className="settings-title">Alert Threshold Settings</h2>
        </div>
        <p className="md-typescale-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
          Set the negative sentiment threshold. When weekly negative feedback exceeds this percentage, an alert banner will appear on the Analytics page.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontWeight: 'bold', minWidth: '40px', textAlign: 'right' }}>{settings.alertThreshold ?? 40}%</span>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.alertThreshold ?? 40}
            onChange={(e) => saveSettings({ ...settings, alertThreshold: parseInt(e.target.value, 10) })}
            style={{ flex: 1, accentColor: 'var(--md-sys-color-primary)', cursor: 'pointer', height: '6px', borderRadius: '3px' }}
          />
        </div>
      </div>

      <style>{`
        .settings-card {
          border: 1px solid var(--md-sys-color-outline-variant);
          border-radius: 16px;
          background-color: var(--md-sys-color-surface);
          padding: 20px;
        }
        .settings-title {
          font-family: var(--md-sys-typescale-title-large-font);
          font-size: var(--md-sys-typescale-title-large-size);
          font-weight: var(--md-sys-typescale-title-large-weight);
          line-height: var(--md-sys-typescale-title-large-line-height);
          letter-spacing: var(--md-sys-typescale-title-large-tracking);
          color: var(--md-sys-color-on-background);
        }
        .settings-buttons {
          gap: 12px;
        }
        .settings-btn {
          flex: 1 1 auto;
          min-width: 200px;
        }
        .provider-switcher {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .provider-tab {
          flex: 1 1 160px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 14px 20px;
          border-radius: 12px;
          border: 2px solid var(--md-sys-color-outline-variant);
          background: var(--md-sys-color-surface-container-lowest);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          color: var(--md-sys-color-on-surface-variant);
        }
        .provider-tab:hover {
          border-color: var(--md-sys-color-primary);
          background: var(--md-sys-color-surface-container-low);
          color: var(--md-sys-color-on-surface);
        }
        .provider-tab--active {
          border-color: var(--md-sys-color-primary);
          background: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
          color: var(--md-sys-color-primary);
        }
        .provider-tab-icon {
          font-size: 1.6rem;
          line-height: 1;
        }
        .provider-tab-label {
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .provider-tab-badge {
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 99px;
          background: var(--md-sys-color-surface-container);
          color: var(--md-sys-color-on-surface-variant);
          font-weight: 500;
        }
        .provider-tab--active .provider-tab-badge {
          background: color-mix(in srgb, var(--md-sys-color-primary) 18%, transparent);
          color: var(--md-sys-color-primary);
        }
        .provider-panel {
          animation: panel-in 0.2s ease;
        }
        @keyframes panel-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
