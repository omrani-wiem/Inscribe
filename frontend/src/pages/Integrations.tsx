import React, { useState, useRef, useEffect } from "react";
import { api } from "../api";
import { FeedbackRecord } from "../types";
import { generateQRCodeURL, downloadQRCode } from "../utils/qrCode";
import { importFromCSVFile } from "../utils/csvImport";
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/icon/icon.js";

interface IntegrationsProps {
  addFeedback: (item: Omit<FeedbackRecord, "id" | "timestamp">) => void;
}

const CSV_TEMPLATE =
  "transcription,rating\n" +
  '"Service excellent, personnel adorable",5\n' +
  '"Attente trop longue, café froid",2\n';

export default function Integrations({ addFeedback }: IntegrationsProps) {
  // ---- QR code ----
  const [shopName, setShopName] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [qrImg, setQrImg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.me()
      .then(m => {
        setShopName(m.shopName);
        setQrUrl(`${window.location.origin}/submit/${m.shopId}`);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (qrUrl) setQrImg(generateQRCodeURL(qrUrl, 300));
  }, [qrUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers indisponible */ }
  };

  const printPoster = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>Affiche</title><style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:60px}
        h1{font-size:44px;margin-bottom:8px} h2{font-weight:400;margin-top:0}
        img{width:420px;height:420px;margin:24px 0} p{font-size:22px}
      </style></head><body>
        <h1>Votre avis compte !</h1>
        <h2>${shopName.replace(/</g, "&lt;")}</h2>
        <img src="${qrImg}" onload="window.print()" />
        <p>Scannez ce code avec votre téléphone<br/>pour nous laisser un avis en 30 secondes.</p>
      </body></html>`
    );
    w.document.close();
  };

  // ---- Import CSV ----
  const csvRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState("");

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const records = await importFromCSVFile(file);
      records.forEach(r => addFeedback(r));
      setImportStatus(`${records.length} avis importés.`);
    } catch {
      setImportStatus("Échec de la lecture du fichier. Vérifiez qu'il contient une colonne « transcription ».");
    }
    e.target.value = "";
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modele-avis.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---- Rapport hebdomadaire ----
  const [digestOn, setDigestOn] = useState(false);
  const [digestEmail, setDigestEmail] = useState("");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [digestMsg, setDigestMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getDigest()
      .then(d => { setDigestOn(d.enabled); setDigestEmail(d.email); setLastSent(d.lastSentAt); })
      .catch(() => {});
  }, []);

  const saveDigest = async () => {
    setBusy(true);
    try {
      const d = await api.saveDigest(digestOn, digestEmail);
      setDigestEmail(d.email);
      setDigestMsg({ text: digestOn ? "Enregistré. Rapport activé chaque lundi à 8h." : "Enregistré. Rapport désactivé.", error: false });
    } catch (e: any) {
      setDigestMsg({ text: e.message, error: true });
    }
    setBusy(false);
  };

  const sendNow = async () => {
    setBusy(true);
    try {
      await api.saveDigest(digestOn, digestEmail);
      const d = await api.sendDigestNow();
      setLastSent(d.lastSentAt);
      setDigestMsg({ text: `Rapport envoyé à ${d.email}.`, error: false });
    } catch (e: any) {
      setDigestMsg({ text: e.message, error: true });
    }
    setBusy(false);
  };

  const card: React.CSSProperties = {
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: 16,
    background: "var(--md-sys-color-surface)",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };
  const title: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10 };
  const muted: React.CSSProperties = { color: "var(--md-sys-color-on-surface-variant)", margin: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: 24 }}>

      {/* 1. QR code */}
      <div className="m3-entrance-up m3-stagger-1" style={card}>
        <div style={title}>
          <md-icon style={{ color: "var(--md-sys-color-primary)" }}>qr_code_2</md-icon>
          <h2 className="settings-title">Votre QR code</h2>
        </div>
        <p className="md-typescale-body-medium" style={muted}>
          Affichez-le dans votre établissement. Vos clients le scannent, laissent leur avis sur un
          formulaire à votre nom, et l'avis arrive ici, analysé automatiquement.
        </p>

        {qrImg && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 20,
                        background: "var(--md-sys-color-surface-container-low)", borderRadius: 12 }}>
            <img src={qrImg} alt="QR code du formulaire d'avis" width={220} height={220}
                 style={{ borderRadius: 8, border: "1px solid var(--md-sys-color-outline-variant)" }} />
            <code style={{ wordBreak: "break-all", textAlign: "center" }}>{qrUrl}</code>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <md-outlined-button onClick={copyLink}>
                <md-icon slot="icon">content_copy</md-icon>
                {copied ? "Copié !" : "Copier le lien"}
              </md-outlined-button>
              <md-outlined-button onClick={() => downloadQRCode(qrUrl).catch(() => alert("Téléchargement impossible."))}>
                <md-icon slot="icon">download</md-icon>
                Télécharger l'image
              </md-outlined-button>
              <md-filled-button onClick={printPoster}>
                <md-icon slot="icon">print</md-icon>
                Imprimer l'affiche
              </md-filled-button>
            </div>
          </div>
        )}

        <details>
          <summary style={{ cursor: "pointer", color: "var(--md-sys-color-primary)" }}>
            Avancé : encoder une autre adresse
          </summary>
          <div style={{ marginTop: 12 }}>
            <md-outlined-text-field label="Adresse à encoder" value={qrUrl} autocomplete="off"
              onInput={(e: any) => setQrUrl(e.target.value)} style={{ width: "100%" }} />
          </div>
        </details>
      </div>

      {/* 2. Import CSV */}
      <div className="m3-entrance-up m3-stagger-2" style={card}>
        <div style={title}>
          <md-icon style={{ color: "var(--md-sys-color-primary)" }}>upload_file</md-icon>
          <h2 className="settings-title">Importer des avis existants</h2>
        </div>
        <p className="md-typescale-body-medium" style={muted}>
          Vous avez déjà des avis dans Excel ou Google Sheets ? Enregistrez-les en <strong>CSV</strong> avec une
          colonne <code>transcription</code> (le texte de l'avis) et, si vous voulez, une colonne <code>rating</code> (note de 1 à 5).
          Si le fichier n'est lu que sur une colonne, choisissez « CSV UTF-8 » dans Excel.
        </p>
        <input type="file" accept=".csv,text/csv" ref={csvRef} onChange={handleCSVImport} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <md-filled-button onClick={() => csvRef.current?.click()}>
            <md-icon slot="icon">table_view</md-icon>
            Choisir un fichier CSV
          </md-filled-button>
          <md-outlined-button onClick={downloadTemplate}>
            <md-icon slot="icon">download</md-icon>
            Télécharger un modèle
          </md-outlined-button>
        </div>
        {importStatus && (
          <p className="md-typescale-body-medium" style={{
            margin: 0,
            color: importStatus.startsWith("Échec") ? "var(--sentiment-negative)" : "var(--sentiment-positive)",
          }}>{importStatus}</p>
        )}
      </div>

      {/* 3. Rapport hebdomadaire */}
      <div className="m3-entrance-up m3-stagger-3" style={card}>
        <div style={title}>
          <md-icon style={{ color: "var(--md-sys-color-primary)" }}>email</md-icon>
          <h2 className="settings-title">Rapport hebdomadaire par e-mail</h2>
        </div>
        <p className="md-typescale-body-medium" style={muted}>
          Chaque lundi à 8h, recevez un résumé de la semaine : nombre d'avis, répartition
          positifs / neutres / négatifs, thèmes principaux et derniers avis négatifs.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={digestOn} onChange={e => setDigestOn(e.target.checked)}
                 style={{ width: 20, height: 20, accentColor: "var(--md-sys-color-primary)" }} />
          <span className="md-typescale-body-large">Recevoir le rapport chaque lundi</span>
        </label>

        <md-outlined-text-field label="Adresse de réception" type="email" value={digestEmail}
          autocomplete="off" onInput={(e: any) => setDigestEmail(e.target.value)} style={{ width: "100%" }} />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <md-filled-button onClick={saveDigest} disabled={busy || undefined}>
            <md-icon slot="icon">save</md-icon>
            Enregistrer
          </md-filled-button>
          <md-outlined-button onClick={sendNow} disabled={busy || undefined}>
            <md-icon slot="icon">send</md-icon>
            Envoyer maintenant
          </md-outlined-button>
        </div>

        {lastSent && (
          <p className="md-typescale-body-small" style={muted}>
            Dernier envoi : {new Date(lastSent).toLocaleString()}
          </p>
        )}
        {digestMsg && (
          <p className="md-typescale-body-medium" style={{
            margin: 0,
            color: digestMsg.error ? "var(--sentiment-negative)" : "var(--sentiment-positive)",
          }}>{digestMsg.text}</p>
        )}
      </div>

      <style>{`
        .settings-title {
          font-family: var(--md-sys-typescale-title-large-font);
          font-size: var(--md-sys-typescale-title-large-size);
          font-weight: var(--md-sys-typescale-title-large-weight);
          color: var(--md-sys-color-on-background);
          margin: 0;
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