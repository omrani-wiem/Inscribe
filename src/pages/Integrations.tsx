import React, { useState, useRef } from "react";
import { FeedbackRecord, EmailJsConfig } from "../types";
import { generateQRCodeURL, downloadQRCode } from "../utils/qrCode";
import { importFromCSVFile } from "../utils/csvImport";
import { sendDigestEmail } from "../utils/emailDigest";
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/icon/icon.js";
import "@material/web/divider/divider.js";

interface IntegrationsProps {
  feedbackList: FeedbackRecord[];
  addFeedback: (item: Omit<FeedbackRecord, "id" | "timestamp">) => void;
  emailJsConfig: EmailJsConfig;
  saveEmailJsConfig: (cfg: EmailJsConfig) => void;
}

export default function Integrations({
  feedbackList,
  addFeedback,
  emailJsConfig,
  saveEmailJsConfig,
}: IntegrationsProps) {
  const [qrUrl, setQrUrl] = useState("https://inkscribe.ai/submit");
  const [qrPreview, setQrPreview] = useState("");
  const [digestStatus, setDigestStatus] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [formsPaste, setFormsPaste] = useState("");
  const csvImportRef = useRef<HTMLInputElement>(null);

  const generateQR = () => {
    setQrPreview(generateQRCodeURL(qrUrl, 300));
  };

  const handleDownloadQR = async () => {
    try {
      await downloadQRCode(qrUrl);
    } catch {
      alert("Failed to download QR code.");
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const records = await importFromCSVFile(file);
      records.forEach((r) => addFeedback(r));
      setImportStatus(`Successfully imported ${records.length} records from CSV.`);
    } catch {
      setImportStatus("Failed to parse CSV file.");
    }
    e.target.value = "";
  };

  const handleFormsPaste = () => {
    if (!formsPaste.trim()) return;
    try {
      const parsed = JSON.parse(formsPaste);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      let count = 0;
      items.forEach((item: any) => {
        const transcription =
          item.transcription || item.feedback || item.text || item.response || item.answer || "";
        if (!transcription) return;
        addFeedback({
          transcription,
          sentiment: item.sentiment ?? "neutral",
          themes: Array.isArray(item.themes) ? item.themes : [],
          rating: typeof item.rating === "number" ? item.rating : null,
          summary: item.summary || transcription.substring(0, 100),
          confidence: "medium",
          sentimentReasoning: "Imported from Forms JSON",
          needsReview: true,
          source: item.source || "Forms Import",
        });
        count++;
      });
      setImportStatus(`Imported ${count} records from JSON. Records marked for review.`);
      setFormsPaste("");
    } catch {
      setImportStatus("Invalid JSON. Make sure to paste a valid JSON array.");
    }
  };

  const handleSendDigest = async () => {
    setDigestStatus("Sending...");
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekly = feedbackList.filter((r) => new Date(r.timestamp).getTime() >= weekAgo);
    try {
      await sendDigestEmail(emailJsConfig, weekly);
      setDigestStatus("Digest sent successfully!");
    } catch (err: any) {
      setDigestStatus("Error: " + err.message);
    }
  };

  const card = {
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: "16px",
    background: "var(--md-sys-color-surface)",
    padding: "24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
  };
  const sectionTitle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "4px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "24px" }}>

      {/* QR Code Generator */}
      <div className="m3-entrance-up m3-stagger-1" style={card}>
        <div style={sectionTitle}>
          <md-icon style={{ color: "var(--md-sys-color-primary)" }}>qr_code_2</md-icon>
          <h2 className="settings-title">QR Code Generator</h2>
        </div>
        <p className="md-typescale-body-medium" style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
          Generate a printable QR code linking to your feedback submission form or any URL. Customers can scan it to leave feedback instantly.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <md-outlined-text-field
              label="URL to encode"
              value={qrUrl}
              onInput={(e: any) => setQrUrl(e.target.value)}
              style={{ width: "100%" }}
              placeholder="https://your-feedback-form.com"
            />
          </div>
          <md-filled-button
            onClick={generateQR}
            style={{ "--md-filled-button-container-height": "56px" }}
          >
            <md-icon slot="icon">qr_code</md-icon>
            Generate QR
          </md-filled-button>
        </div>

        {qrPreview && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "20px", background: "var(--md-sys-color-surface-container-low)", borderRadius: "12px" }}>
            <img src={qrPreview} alt="QR Code" style={{ width: "220px", height: "220px", borderRadius: "8px", border: "1px solid var(--md-sys-color-outline-variant)" }} />
            <p className="md-typescale-body-small" style={{ color: "var(--md-sys-color-on-surface-variant)", textAlign: "center" }}>
              Scan to visit: <strong>{qrUrl}</strong>
            </p>
            <md-outlined-button onClick={handleDownloadQR}>
              <md-icon slot="icon">download</md-icon>
              Download QR PNG
            </md-outlined-button>
          </div>
        )}
      </div>

      {/* CSV Import */}
      <div className="m3-entrance-up m3-stagger-2" style={card}>
        <div style={sectionTitle}>
          <md-icon style={{ color: "var(--md-sys-color-primary)" }}>upload_file</md-icon>
          <h2 className="settings-title">CSV / Spreadsheet Import</h2>
        </div>
        <p className="md-typescale-body-medium" style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
          Bulk-import existing feedback from a CSV file. The file must have at least a <code>transcription</code> (or <code>feedback</code> / <code>text</code>) column. Optional columns: <code>sentiment</code>, <code>rating</code>, <code>themes</code>, <code>summary</code>, <code>tags</code>, <code>source</code>.
        </p>
        <input type="file" accept=".csv,text/csv" ref={csvImportRef} onChange={handleCSVImport} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: "12px" }}>
          <md-filled-button onClick={() => csvImportRef.current?.click()}>
            <md-icon slot="icon">table_view</md-icon>
            Choose CSV File
          </md-filled-button>
        </div>
        {importStatus && (
          <p className="md-typescale-body-medium" style={{ color: importStatus.startsWith("Error") || importStatus.startsWith("Failed") ? "var(--sentiment-negative)" : "var(--sentiment-positive)", marginTop: "4px" }}>
            {importStatus}
          </p>
        )}
      </div>

      {/* Google Forms / Typeform JSON Import */}
      <div className="m3-entrance-up m3-stagger-3" style={card}>
        <div style={sectionTitle}>
          <md-icon style={{ color: "var(--md-sys-color-primary)" }}>integration_instructions</md-icon>
          <h2 className="settings-title">Google Forms / Typeform Import</h2>
        </div>
        <p className="md-typescale-body-medium" style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
          Export your form responses as JSON and paste them below. Each entry should have a <code>transcription</code>, <code>feedback</code>, <code>text</code>, or <code>response</code> field. All imported records will be flagged for review.
        </p>
        <textarea
          value={formsPaste}
          onChange={(e) => setFormsPaste(e.target.value)}
          placeholder='Paste JSON here, e.g. [{"feedback": "Great service!", "rating": 5}, ...]'
          style={{
            width: "100%", minHeight: "120px", padding: "12px", borderRadius: "8px",
            border: "1px solid var(--md-sys-color-outline)", background: "var(--md-sys-color-surface-container-low)",
            color: "var(--md-sys-color-on-surface)", fontFamily: "monospace", fontSize: "0.85rem",
            resize: "vertical", boxSizing: "border-box"
          }}
        />
        <div style={{ display: "flex", gap: "12px" }}>
          <md-filled-button onClick={handleFormsPaste} disabled={!formsPaste.trim()}>
            <md-icon slot="icon">publish</md-icon>
            Import JSON Records
          </md-filled-button>
        </div>
        {importStatus && (
          <p className="md-typescale-body-medium" style={{ color: importStatus.startsWith("Error") || importStatus.startsWith("Invalid") ? "var(--sentiment-negative)" : "var(--sentiment-positive)" }}>
            {importStatus}
          </p>
        )}
      </div>

      {/* EmailJS Digest */}
      <div className="m3-entrance-up m3-stagger-4" style={card}>
        <div style={sectionTitle}>
          <md-icon style={{ color: "var(--md-sys-color-primary)" }}>email</md-icon>
          <h2 className="settings-title">Weekly Digest Email (via EmailJS)</h2>
        </div>
        <p className="md-typescale-body-medium" style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
          Send a summary of last week's feedback to any email address using <a href="https://www.emailjs.com" target="_blank" rel="noopener" style={{ color: "var(--md-sys-color-primary)" }}>EmailJS</a> (free — no backend required). Configure your EmailJS credentials below.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <md-outlined-text-field label="EmailJS Service ID" value={emailJsConfig.serviceId}
              onInput={(e: any) => saveEmailJsConfig({ ...emailJsConfig, serviceId: e.target.value })}
              placeholder="service_xxxxxxx" style={{ width: "100%" }} />
            <md-outlined-text-field label="EmailJS Template ID" value={emailJsConfig.templateId}
              onInput={(e: any) => saveEmailJsConfig({ ...emailJsConfig, templateId: e.target.value })}
              placeholder="template_xxxxxxx" style={{ width: "100%" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <md-outlined-text-field label="EmailJS Public Key" type="password" value={emailJsConfig.publicKey}
              onInput={(e: any) => saveEmailJsConfig({ ...emailJsConfig, publicKey: e.target.value })}
              placeholder="Your public key" style={{ width: "100%" }} />
            <md-outlined-text-field label="Recipient Email" type="email" value={emailJsConfig.recipientEmail}
              onInput={(e: any) => saveEmailJsConfig({ ...emailJsConfig, recipientEmail: e.target.value })}
              placeholder="manager@example.com" style={{ width: "100%" }} />
          </div>
        </div>

        <div style={{ padding: "10px 14px", borderRadius: "8px", background: "var(--md-sys-color-surface-container-low)", border: "1px solid var(--md-sys-color-outline-variant)" }}>
          <p className="md-typescale-body-small" style={{ margin: 0, color: "var(--md-sys-color-on-surface-variant)" }}>
            📧 <strong>Template variables</strong> available: <code>{"{{total_count}}"}</code>, <code>{"{{positive_count}}"}</code>, <code>{"{{neutral_count}}"}</code>, <code>{"{{negative_count}}"}</code>, <code>{"{{negative_pct}}"}</code>, <code>{"{{top_themes}}"}</code>, <code>{"{{date_range}}"}</code>, <code>{"{{to_email}}"}</code>
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <md-filled-button onClick={handleSendDigest}>
            <md-icon slot="icon">send</md-icon>
            Send This Week's Digest
          </md-filled-button>
          <md-outlined-button onClick={() => window.open("https://www.emailjs.com", "_blank", "noopener")}>
            <md-icon slot="icon">open_in_new</md-icon>
            Set Up EmailJS
          </md-outlined-button>
        </div>
        {digestStatus && (
          <p className="md-typescale-body-medium" style={{ color: digestStatus.startsWith("Error") ? "var(--sentiment-negative)" : "var(--sentiment-positive)" }}>
            {digestStatus}
          </p>
        )}
      </div>

      <style>{`
        .settings-title {
          font-family: var(--md-sys-typescale-title-large-font);
          font-size: var(--md-sys-typescale-title-large-size);
          font-weight: var(--md-sys-typescale-title-large-weight);
          color: var(--md-sys-color-on-background);
        }
        code {
          background: var(--md-sys-color-surface-container);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.82em;
        }
      `}</style>
    </div>
  );
}
