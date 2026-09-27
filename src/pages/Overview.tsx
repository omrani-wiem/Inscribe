import React from 'react';
import { FeedbackRecord } from '../types';
import { SentimentHistoryChart, SegmentedSentimentBar } from '../components/Charts';
import '@material/web/button/filled-button.js';
import '@material/web/icon/icon.js';

interface OverviewProps {
  data: FeedbackRecord[];
  setTab: (tab: string) => void;
  setSelectedFeedback: (item: FeedbackRecord | null) => void;
}

export default function Overview({ data, setTab, setSelectedFeedback }: OverviewProps) {
  if (data.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        textAlign: 'center',
        padding: '24px'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>📝</div>
        <h2 className="md-typescale-headline-small" style={{ marginBottom: '8px' }}>No Feedback Data Yet</h2>
        <p className="md-typescale-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '24px', maxWidth: '400px' }}>
          Upload some customer feedback handwriting photos in the Analyzer tab to run OCR transcribing and sentiment analysis.
        </p>
        <md-filled-button onClick={() => setTab('analyzer')}>
          <md-icon slot="icon">document_scanner</md-icon>
          Go to Analyzer
        </md-filled-button>
      </div>
    );
  }

  // Calculate metrics
  const totalCount = data.length;
  const needsReviewCount = data.filter(i => i.needsReview).length;
  
  // Rate calculation
  const totalSuccess = data.filter(i => i.confidence !== 'low').length;
  const analysisRate = Math.round((totalSuccess / totalCount) * 100);

  // Rating calculation
  const ratedItems = data.filter(i => i.rating !== null);
  const avgRating = ratedItems.length > 0
    ? (ratedItems.reduce((acc, item) => acc + (item.rating || 0), 0) / ratedItems.length).toFixed(1)
    : '–';

  // Sentiment distributions
  const positiveCount = data.filter(i => i.sentiment === 'positive').length;
  const neutralCount = data.filter(i => i.sentiment === 'neutral').length;
  const negativeCount = data.filter(i => i.sentiment === 'negative').length;

  const pctPos = Math.round((positiveCount / totalCount) * 100);
  const pctNeu = Math.round((neutralCount / totalCount) * 100);
  const pctNeg = Math.round((negativeCount / totalCount) * 100);

  // Net Sentiment Score: Pos% - Neg%
    // Net Sentiment Score: Pos% - Neg%
  const netSentiment = pctPos - pctNeg;

  // Real period-over-period trends: last 30 days vs the 30 days before.
  // Accurate only when the date filter is "All time" (see note above).
  const DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const last30 = data.filter(i => now - new Date(i.timestamp).getTime() <= 30 * DAY_MS);
  const prev30 = data.filter(i => {
    const age = now - new Date(i.timestamp).getTime();
    return age > 30 * DAY_MS && age <= 60 * DAY_MS;
  });

  const countDelta = prev30.length > 0 ? ((last30.length - prev30.length) / prev30.length) * 100 : null;

  const confidentRateOf = (list: FeedbackRecord[]) =>
    list.length > 0 ? (list.filter(i => i.confidence !== 'low').length / list.length) * 100 : null;
  const rateLast = confidentRateOf(last30);
  const ratePrev = confidentRateOf(prev30);
  const rateDelta = (rateLast !== null && ratePrev !== null) ? rateLast - ratePrev : null;

  const avgRatingOf = (list: FeedbackRecord[]) => {
    const rated = list.filter(i => i.rating !== null);
    return rated.length > 0 ? rated.reduce((acc, i) => acc + (i.rating || 0), 0) / rated.length : null;
  };
  const avgLast = avgRatingOf(last30);
  const avgPrev = avgRatingOf(prev30);
  const ratingDelta = (avgLast !== null && avgPrev !== null) ? avgLast - avgPrev : null;

  // Mini table: latest 5 records

  // Mini table: latest 5 records
  const recentRecords = [...data]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
      
      {/* KPI Card Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {/* KPI 1 */}
        <div className="kpi-card m3-entrance-up m3-stagger-1">
          <div className="kpi-header">
            <span className="kpi-icon" style={{ backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
              <md-icon style={{ fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>chat_bubble_outline</md-icon>
            </span>
            <span className="md-typescale-label-large" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Total Feedback</span>
          </div>
          <div className="kpi-value">{totalCount}</div>
                    {countDelta === null ? (
            <div className="kpi-trend" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              <span>No previous period to compare</span>
            </div>
          ) : (
            <div className={`kpi-trend ${countDelta >= 0 ? 'positive' : 'negative'}`}>
              <md-icon style={{ fontSize: '14px' }}>{countDelta >= 0 ? 'arrow_upward' : 'arrow_downward'}</md-icon>
              <span>{countDelta >= 0 ? '+' : ''}{countDelta.toFixed(1)}% vs previous 30 days</span>
            </div>
          )}
        </div>

        {/* KPI 2 */}
        <div className="kpi-card m3-entrance-up m3-stagger-2">
          <div className="kpi-header">
            <span className="kpi-icon" style={{ 
              backgroundColor: needsReviewCount > 0 ? 'var(--sentiment-negative-container)' : 'var(--md-sys-color-surface-container)', 
              color: needsReviewCount > 0 ? 'var(--sentiment-negative-on-container)' : 'var(--md-sys-color-outline)' 
            }}>
              <md-icon style={{ fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>rate_review</md-icon>
            </span>
            <span className="md-typescale-label-large" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Needs Review</span>
          </div>
          <div className="kpi-value" style={{ color: needsReviewCount > 0 ? 'var(--sentiment-negative)' : 'inherit' }}>
            {needsReviewCount}
          </div>
          <div className="kpi-trend" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
            <span>Unresolved transcriptions</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="kpi-card m3-entrance-up m3-stagger-3">
          <div className="kpi-header">
            <span className="kpi-icon" style={{ backgroundColor: 'var(--md-sys-color-tertiary-container)', color: 'var(--md-sys-color-on-tertiary-container)' }}>
              <md-icon style={{ fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>insights</md-icon>
            </span>
            <span className="md-typescale-label-large" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Confidence Rate</span>
          </div>
          <div className="kpi-value">{analysisRate}%</div>
                    {rateDelta === null ? (
            <div className="kpi-trend" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              <span>No previous period to compare</span>
            </div>
          ) : (
            <div className={`kpi-trend ${rateDelta >= 0 ? 'positive' : 'negative'}`}>
              <md-icon style={{ fontSize: '14px' }}>{rateDelta >= 0 ? 'arrow_upward' : 'arrow_downward'}</md-icon>
              <span>{rateDelta >= 0 ? '+' : ''}{rateDelta.toFixed(1)} pts vs previous 30 days</span>
            </div>
          )}
        </div>

        {/* KPI 4 */}
        <div className="kpi-card m3-entrance-up m3-stagger-4">
          <div className="kpi-header">
            <span className="kpi-icon" style={{ backgroundColor: 'var(--md-sys-color-surface-container-highest)', color: 'var(--md-sys-color-tertiary)' }}>
              <md-icon style={{ fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>star</md-icon>
            </span>
            <span className="md-typescale-label-large" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Avg. Star Rating</span>
          </div>
          <div className="kpi-value">{avgRating} <span style={{ fontSize: '1.25rem', color: 'var(--md-sys-color-tertiary)' }}>★</span></div>
                    {ratingDelta === null ? (
            <div className="kpi-trend" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              <span>No previous period to compare</span>
            </div>
          ) : (
            <div className={`kpi-trend ${ratingDelta >= 0 ? 'positive' : 'negative'}`}>
              <md-icon style={{ fontSize: '14px' }}>{ratingDelta >= 0 ? 'arrow_upward' : 'arrow_downward'}</md-icon>
              <span>{ratingDelta >= 0 ? '+' : ''}{ratingDelta.toFixed(1)} stars vs previous 30 days</span>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Chart Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '20px'
      }} className="chart-row">
        
        {/* Left wider card: Sentiment History */}
        <div className="dashboard-panel m3-entrance-up m3-stagger-5">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="panel-title">Sentiment History</h2>
            <span 
              onClick={() => setTab('analytics')} 
              className="md-typescale-label-large-prominent"
              style={{ color: 'var(--md-sys-color-primary)', cursor: 'pointer' }}
            >
              Details
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
            <span className="md-typescale-headline-large">
              {netSentiment >= 0 ? `+${netSentiment}%` : `${netSentiment}%`}
            </span>
            <span className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              Net Sentiment Score
            </span>
          </div>

          <SentimentHistoryChart data={data} />
        </div>

        {/* Right narrower card: Responses Summary */}
        <div className="dashboard-panel m3-entrance-up m3-stagger-6" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="panel-title">Responses</h2>
            <span 
              onClick={() => setTab('table')} 
              className="md-typescale-label-large-prominent"
              style={{ color: 'var(--md-sys-color-primary)', cursor: 'pointer' }}
            >
              View all
            </span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div className="md-typescale-display-medium">{totalCount}</div>
            <div className="md-typescale-label-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', textTransform: 'uppercase', marginTop: '4px' }}>
              total entries
            </div>
          </div>

          <SegmentedSentimentBar data={data} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px', flex: 1 }}>
            {[
              { label: 'Positive', count: positiveCount, pct: pctPos, color: 'var(--sentiment-positive)', icon: 'arrow_upward' },
              { label: 'Neutral', count: neutralCount, pct: pctNeu, color: 'var(--sentiment-neutral)', icon: 'trending_flat' },
              { label: 'Negative', count: negativeCount, pct: pctNeg, color: 'var(--sentiment-negative)', icon: 'arrow_downward' }
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: row.color }} />
                  <span style={{ fontWeight: '500' }}>{row.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                  <span>{row.count} ({row.pct}%)</span>
                  <md-icon style={{ fontSize: '16px', color: row.color }}>{row.icon}</md-icon>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setTab('table')}
            style={{
              marginTop: 'auto',
              width: '100%',
              padding: '10px',
              borderRadius: '100px',
              border: '1px solid var(--md-sys-color-outline)',
              backgroundColor: 'transparent',
              color: 'var(--md-sys-color-primary)',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}            className="md-typescale-label-large-prominent"
            >
              All feedback <md-icon style={{ fontSize: '16px' }}>arrow_forward</md-icon>
            </button>
        </div>
      </div>

      {/* Mini Table Card */}
      <div className="dashboard-panel m3-entrance-up m3-stagger-7">
        <h2 className="panel-title" style={{ marginBottom: '16px' }}>Recent Feedback</h2>
        <div className="m3-table-container">
          <table className="m3-table">
            <thead>
              <tr>
                <th className="md-typescale-label-medium">Date</th>
                <th className="md-typescale-label-medium">Source</th>
                <th className="md-typescale-label-medium">Sentiment</th>
                <th className="md-typescale-label-medium">Themes</th>
                <th className="md-typescale-label-medium">Message</th>
                <th className="md-typescale-label-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {recentRecords.map(item => (
                <tr 
                  key={item.id} 
                  onClick={() => setSelectedFeedback(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {new Date(item.timestamp).toLocaleDateString()}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{item.source || '—'}</td>
                  <td>{getSentimentPill(item.sentiment)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {item.themes.slice(0, 2).map((t, idx) => (
                        <span key={idx} style={{
                          padding: '2px 8px',
                          backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          textTransform: 'capitalize'
                        }}>
                          {t}
                        </span>
                      ))}
                      {item.themes.length > 2 && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-outline)' }}>
                          +{item.themes.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{
                    maxWidth: '300px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.transcription}
                  </td>
                  <td style={{ fontWeight: 'bold', color: 'var(--md-sys-color-tertiary)' }}>
                    {item.rating ? `${item.rating}★` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .kpi-card {
          border: 1px solid var(--md-sys-color-outline-variant);
          border-radius: 16px;
          background-color: var(--md-sys-color-surface);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .kpi-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .kpi-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .kpi-value {
          font-family: var(--md-sys-typescale-display-small-font);
          font-size: var(--md-sys-typescale-display-small-size);
          font-weight: var(--md-sys-typescale-display-small-weight);
          line-height: var(--md-sys-typescale-display-small-line-height);
          letter-spacing: var(--md-sys-typescale-display-small-tracking);
          color: var(--md-sys-color-on-background);
        }
        .kpi-trend {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: var(--md-sys-typescale-label-small-font);
          font-size: var(--md-sys-typescale-label-small-size);
          font-weight: var(--md-sys-typescale-label-small-weight);
          line-height: var(--md-sys-typescale-label-small-line-height);
          letter-spacing: var(--md-sys-typescale-label-small-tracking);
        }
        .kpi-trend.positive {
          color: var(--sentiment-positive);
        }
        .kpi-trend.negative {
          color: var(--sentiment-negative);
        }
        .dashboard-panel {
          border: 1px solid var(--md-sys-color-outline-variant);
          border-radius: 16px;
          background-color: var(--md-sys-color-surface);
          padding: 20px;
        }
        .panel-title {
          font-family: var(--md-sys-typescale-title-large-font);
          font-size: var(--md-sys-typescale-title-large-size);
          font-weight: var(--md-sys-typescale-title-large-weight);
          line-height: var(--md-sys-typescale-title-large-line-height);
          letter-spacing: var(--md-sys-typescale-title-large-tracking);
          color: var(--md-sys-color-on-background);
        }
        @media (max-width: 900px) {
          .chart-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
