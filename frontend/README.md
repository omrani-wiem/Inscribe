# InkScribe AI — Handwritten Feedback Dashboard

Application web qui transforme des cartes de feedback client manuscrites (photos ou PDF scannés) en données exploitables : transcription OCR, analyse de sentiment, extraction de thèmes, et tableau de bord analytique.

## Sommaire

- [InkScribe AI — Handwritten Feedback Dashboard](#inkscribe-ai--handwritten-feedback-dashboard)
  - [Sommaire](#sommaire)
  - [Fonctionnalités](#fonctionnalités)
  - [Architecture](#architecture)
  - [Pipeline d'analyse](#pipeline-danalyse)
  - [Installation](#installation)
  - [Configuration des providers](#configuration-des-providers)
  - [Structure du projet](#structure-du-projet)
  - [Stockage des données](#stockage-des-données)
  - [Limitations connues](#limitations-connues)
  - [Pistes d'amélioration](#pistes-damélioration)

## Fonctionnalités

- **Ingestion multi-source** : upload d'images (drag & drop, sélection, presse-papiers), capture caméra (webcam), import de PDF multi-pages (chaque page devient une image analysée séparément).
- **OCR + analyse IA**, au choix parmi 4 providers :
  - **Google Gemini** (vision multimodale) — transcription + sentiment + thèmes en un seul appel.
  - **Mistral OCR** — extraction de texte, puis analyse via Mistral Chat (avec repli local si l'appel échoue).
  - **OCR.space** (Engine 2, spécialisé écriture manuscrite) — extraction de texte, puis analyse **100% locale** (aucune deuxième clé API requise).
  - **Groq Cloud** — actuellement limité à la ré-analyse texte (aucun modèle vision disponible, voir [Limitations](#limitations-connues)).
- **Analyse de sentiment locale par modèle de langage** (transformers.js, RoBERTa fine-tuné, exécuté dans le navigateur) au lieu d'une simple liste de mots-clés : gère la négation et généralise à un vocabulaire non prédéfini.
- **Prétraitement d'image optionnel** (niveaux de gris, étirement de contraste, binarisation adaptative) avant envoi à OCR.space, pour améliorer la lisibilité d'une écriture peu contrastée.
- **Détection de doublons** entre feedbacks par similarité de Jaccard sur les tokens.
- **Explicabilité du sentiment** : deux modes de surlignage du texte — mots-clés positifs/négatifs, et attribution par occlusion (impact de chaque mot mesuré en le retirant du calcul).
- **Tableau de bord** : KPIs, tendances sur 30 jours, historique de sentiment, filtres (sentiment, confiance, thème, date), export/import CSV et JSON, génération de réponses automatiques par IA, tags personnalisés, QR code de collecte, import Google Forms/Typeform, digest hebdomadaire par email (EmailJS).

## Architecture

```
Photo / PDF
     │
     ▼
┌─────────────────┐
│  Analyzer.tsx    │  upload, caméra, extraction PDF (pdf.js)
└────────┬─────────┘
         ▼
┌─────────────────────────────────────────────┐
│  store.ts — analyzeBatch()                   │
│                                               │
│  ├─ Gemini Vision API      (cloud)           │
│  ├─ Mistral OCR + Chat     (cloud)           │
│  └─ OCR.space               (cloud, texte)   │
│        └─ prétraitement image (optionnel)    │
│        └─ analyse locale (transformers.js)   │
└────────┬──────────────────────────────────────┘
         ▼
   FeedbackRecord  →  localStorage  →  Dashboard
```

Le state global (liste de feedbacks, file d'attente d'analyse, réglages) est géré par un hook custom `useFeedbackStore` (`src/store.ts`), sans librairie de state management externe. La persistance se fait dans `localStorage`.

## Pipeline d'analyse

1. **Extraction** : si le fichier est un PDF, chaque page est rendue en PNG via `pdf.js` (`utils/pdfExtractor.ts`).
2. **Transcription** : selon le provider choisi, l'image est envoyée à un modèle vision (Gemini, Mistral) ou à un moteur OCR classique (OCR.space).
3. **Prétraitement** *(OCR.space uniquement)* : `utils/imagePreprocess.ts` applique un étirement de contraste puis une binarisation adaptative par bloc, pour compenser un éclairage inégal ou un contraste faible. Ce traitement n'est volontairement **pas** appliqué avant Gemini/Mistral, dont les modèles vision sont déjà robustes au bruit et pourraient perdre en précision sur des traits fins d'écriture manuscrite avec un contraste trop agressif.
4. **Analyse de sentiment** :
   - Gemini/Mistral : le LLM renvoie directement sentiment, thèmes, note et résumé.
   - OCR.space (et repli Mistral) : `analyzeTextLocally` (`store.ts`) délègue le sentiment à un modèle Transformer (`Xenova/twitter-roberta-base-sentiment-latest`, via `@xenova/transformers`), exécuté entièrement côté client. L'extraction de thèmes reste basée sur une correspondance de mots-clés (EN + FR).
5. **Détection de doublons** : après chaque changement de données, une similarité de Jaccard est calculée sur les tokens de chaque paire de transcriptions (seuil 0.75).

## Installation

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build de production (tsc + vite build)
```

Le premier appel à l'analyse locale télécharge le modèle de sentiment (~60 Mo) et le met en cache navigateur ; les appels suivants sont rapides.

## Configuration des providers

Tous les réglages (clés API, provider actif, thème, seuil d'alerte) sont configurables depuis l'onglet **Settings**, sans variable d'environnement. Les clés sont stockées uniquement en local (`localStorage`) et ne sont jamais envoyées ailleurs qu'à l'API du provider concerné.

| Provider | Clé requise | Où l'obtenir |
|---|---|---|
| Gemini | Oui | aistudio.google.com |
| Mistral | Oui | console.mistral.ai |
| OCR.space | Oui (clé démo `helloworld` disponible) | ocr.space/ocrapi |
| Groq | Oui (texte seulement) | console.groq.com |

 Les clés API sont sensibles : ne les commitez jamais dans le code ou l'historique git. Si une clé a été exposée par erreur, révoquez-la immédiatement depuis le portail du provider concerné.

## Structure du projet

```
src/
├── App.tsx                 orchestration des onglets, filtres globaux
├── store.ts                state, appels API, analyse locale
├── types.ts                types partagés (FeedbackRecord, QueueItem, AppSettings)
├── pages/
│   ├── Overview.tsx         KPIs et tendances
│   ├── Analyzer.tsx          upload, caméra, file d'attente d'analyse
│   ├── FeedbackTable.tsx     tableau, filtres, détail d'un feedback
│   ├── Analytics.tsx         analyses par thème/sentiment
│   ├── Integrations.tsx      QR code, import CSV/JSON, digest email
│   └── Settings.tsx          providers, thème, sauvegarde/restauration
└── utils/
    ├── pdfExtractor.ts        rendu des pages PDF en images
    ├── imagePreprocess.ts     prétraitement d'image pour OCR.space
    ├── localSentiment.ts      classification de sentiment (transformers.js)
    ├── csvImport.ts / csvExport.ts
    ├── qrCode.ts
    └── emailDigest.ts
```

## Stockage des données

Toutes les données (feedbacks, réglages) sont stockées dans le `localStorage` du navigateur — aucun backend, aucune base de données distante. Cela implique :

- Les données ne sont disponibles que sur l'appareil/navigateur où elles ont été créées.
- `localStorage` a une limite d'environ 5 Mo ; l'application inclut un repli qui sauvegarde les feedbacks sans les images scannées si cette limite est atteinte, mais **cette limite reste une contrainte structurelle** pour un usage à grande échelle.
- Vider le cache du navigateur ou changer d'appareil sans exporter au préalable entraîne une perte de données. Utilisez la sauvegarde JSON (Settings → Data Backup) régulièrement.

## Limitations connues

- **Groq** ne propose plus de modèle vision gratuit accessible depuis ce projet ; le provider reste utilisable uniquement pour la ré-analyse de texte déjà transcrit.
- **Pas de backend** : toute la logique tourne côté client, ce qui simplifie le déploiement mais limite le volume de données gérable et empêche un partage multi-utilisateurs.
- **Extraction de thèmes par mots-clés** : contrairement au sentiment (modèle ML), les thèmes restent détectés par correspondance de mots-clés et peuvent manquer un thème exprimé avec un vocabulaire non couvert.
- **OCR.space** dépend d'un tiers externe (quota gratuit limité) ; en cas d'indisponibilité, aucun repli automatique vers un autre provider n'est implémenté.

## Pistes d'amélioration

- Étendre l'extraction de thèmes à un modèle de classification multi-label plutôt qu'à des mots-clés.
- Ajouter une évaluation quantitative (accord entre l'analyse locale et un LLM cloud sur un même échantillon) pour objectiver la fiabilité du pipeline local.
- Remplacer `localStorage` par IndexedDB pour lever la limite de taille, notamment pour les images scannées.
- Ajouter une correction d'inclinaison (deskew) au prétraitement d'image.