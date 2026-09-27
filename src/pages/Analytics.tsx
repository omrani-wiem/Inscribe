import React from 'react';
import { FeedbackRecord } from '../types';
import { TopThemesChart, RatingDistributionChart, TimeSeriesChart, WordCloudChart, ThemeTrendChart } from '../components/Charts';
import '@material/web/icon/icon.js';

interface AnalyticsProps {
  data: FeedbackRecord[];
  setTab: (tab: string) => void;
  setThemeFilter: (theme: string) => void;
  alertThreshold?: number; // threshold in %
}

export default function Analytics({ data, setTab, setThemeFilter, alertThreshold = 40 }: AnalyticsProps) {
  // Compute negative feedback percentage for current week
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeekData = data.filter(r => new Date(r.timestamp).getTime() >= weekAgo);
  const negativeThisWeek = thisWeekData.filter(r => r.sentiment === 'negative').length;
  const negativePctThisWeek = thisWeekData.length > 0 ? Math.round((negativeThisWeek / thisWeekData.length) * 100) : 0;
  const isAlertActive = negativePctThisWeek >= alertThreshold;

  // Extract all unique themes
  const themeCounts: Record<string, { positive: number; neutral: number; negative: number; total: number }> = {};
  
  data.forEach(item => {
    item.themes.forEach(theme => {
      const t = theme.toLowerCase().trim();
      if (!t) return;
      if (!themeCounts[t]) {
        themeCounts[t] = { positive: 0, neutral: 0, negative: 0, total: 0 };
      }
      themeCounts[t][item.sentiment]++;
      themeCounts[t].total++;
    });
  });

  const sortedThemeDetails = Object.entries(themeCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6); // Top 6 themes for breakdown grid

  const recurrentFeedbacks = Object.entries(themeCounts).map(([theme, counts]) => {
    const matchingRecords = data.filter(item => 
      item.themes.some(t => t.toLowerCase().trim() === theme)
    );
    const representativeRecord = matchingRecords.find(r => r.transcription) || matchingRecords[0];
    const rawSnippet = representativeRecord ? representativeRecord.transcription : '';
    const snippet = rawSnippet.length > 80 ? rawSnippet.substring(0, 80) + '...' : rawSnippet;
    
    const ratings = matchingRecords.map(r => r.rating).filter((r): r is number => r !== null);
    const avgRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : 'N/A';

    return {
      theme,
      count: counts.total,
      avgRating,
      positivePct: Math.round((counts.positive / counts.total) * 100),
      neutralPct: Math.round((counts.neutral / counts.total) * 100),
      negativePct: Math.round((counts.negative / counts.total) * 100),
      snippet
    };
  }).sort((a, b) => b.count - a.count);

  const handleThemeClick = (theme: string) => {
    setThemeFilter(theme);
    setTab('table');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
      
      {/* Alert Threshold Banner */}
      {isAlertActive && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'var(--sentiment-negative-container)',
          color: 'var(--sentiment-negative-on-container)',
          border: '1px solid var(--sentiment-negative)',
          boxShadow: '0 4px 12px rgba(211, 47, 47, 0.15)'
        }} className="m3-entrance-up">
          <md-icon style={{ fontSize: '28px' }}>warning</md-icon>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 'bold' }}>Negative Sentiment Alert</h4>
            <p className="md-typescale-body-medium" style={{ margin: 0 }}>
              Negative feedback this week is at <strong>{negativePctThisWeek}%</strong>, which exceeds your alert threshold of <strong>{alertThreshold}%</strong>. Please inspect recent negative feedback.
            </p>
          </div>
          <md-filled-button
            onClick={() => { setTab('table'); setThemeFilter(''); }}
            style={{
              '--md-filled-button-container-color': 'var(--sentiment-negative)',
              '--md-filled-button-label-text-color': '#fff'
            }}
          >
            Review Entries
          </md-filled-button>
        </div>
      )}

      {/* Top row with theme frequencies & rating distribution */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px'
      }} className="analytics-top-row">
        
        {/* Top Themes */}
        <div className="analytics-card m3-entrance-up m3-stagger-1">
          <h2 className="analytics-title" style={{ marginBottom: '16px' }}>Top Themes Frequency</h2>
          <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
            Clicking on a theme filters the Feedback Table to only matching entries.
          </p>
          <TopThemesChart data={data} onThemeClick={handleThemeClick} />
        </div>

        {/* Rating Distribution */}
        <div className="analytics-card m3-entrance-up m3-stagger-2">
          <h2 className="analytics-title" style={{ marginBottom: '16px' }}>Rating Distribution</h2>
          <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '24px' }}>
            A histogram of numeric feedback ratings transcribed by the OCR system.
          </p>
          <div style={{ padding: '8px' }}>
            <RatingDistributionChart data={data} />
          </div>
        </div>
      </div>

      {/* Time-Series Trend & Word Cloud */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px'
      }} className="analytics-top-row">
        
        {/* Time-Series Chart */}
        <div className="analytics-card m3-entrance-up">
          <h2 className="analytics-title" style={{ marginBottom: '8px' }}>Sentiment Trends (Last 30 Days)</h2>
          <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
            Analyze daily volumes of feedback across positive, neutral, and negative sentiment.
          </p>
          <TimeSeriesChart data={data} />
        </div>

        {/* Word Cloud */}
        <div className="analytics-card m3-entrance-up">
          <h2 className="analytics-title" style={{ marginBottom: '8px' }}>Word Cloud Analytics</h2>
          <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
            Recurring keywords extracted from the transcribed feedback text.
          </p>
          <WordCloudChart data={data} />
        </div>
      </div>

      {/* Theme Trends over time */}
      <div className="analytics-card m3-entrance-up">
        <h2 className="analytics-title" style={{ marginBottom: '8px' }}>Weekly Theme Distribution Trend</h2>
        <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
          Weekly changes in frequency of the top 5 most popular themes.
        </p>
        <ThemeTrendChart data={data} />
      </div>

      {/* Theme Sentiment Breakdown Grid */}
      <div className="analytics-card">
        <h2 className="analytics-title" style={{ marginBottom: '8px' }}>Sentiment by Theme</h2>
        <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '24px' }}>
          Analyze which specific topics drive customer satisfaction or complaints.
        </p>

        {sortedThemeDetails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--md-sys-color-on-surface-variant)' }}>
            No themes available to display.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px'
          }}>
            {sortedThemeDetails.map(([theme, counts]) => {
              const pctPos = Math.round((counts.positive / counts.total) * 100);
              const pctNeu = Math.round((counts.neutral / counts.total) * 100);
              const pctNeg = Math.round((counts.negative / counts.total) * 100);

              return (
                <div 
                  key={theme} 
                  onClick={() => handleThemeClick(theme)}
                  style={{
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    borderRadius: '12px',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'border-color var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized), background-color var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)',
                    backgroundColor: 'var(--md-sys-color-surface)'
                  }}
                  className="theme-breakdown-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.95rem', textTransform: 'capitalize', color: 'var(--md-sys-color-primary)' }}>
                      {theme}
                    </span>
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--md-sys-color-surface-container-high)', fontWeight: 'bold' }}>
                      {counts.total} entries
                    </span>
                  </div>

                  {/* Visual segment progress bar */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    display: 'flex',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    marginBottom: '12px'
                  }}>
                    {counts.positive > 0 && <div style={{ width: `${pctPos}%`, backgroundColor: 'var(--sentiment-positive)' }} />}
                    {counts.neutral > 0 && <div style={{ width: `${pctNeu}%`, backgroundColor: 'var(--sentiment-neutral)' }} />}
                    {counts.negative > 0 && <div style={{ width: `${pctNeg}%`, backgroundColor: 'var(--sentiment-negative)' }} />}
                  </div>

                  {/* Segment Details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    <span style={{ color: 'var(--sentiment-positive)', fontWeight: '500' }}>Pos: {pctPos}%</span>
                    <span style={{ color: 'var(--sentiment-neutral)', fontWeight: '500' }}>Neu: {pctNeu}%</span>
                    <span style={{ color: 'var(--sentiment-negative)', fontWeight: '500' }}>Neg: {pctNeg}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recurrent Feedbacks Table Section */}
      <div className="analytics-card">
        <h2 className="analytics-title" style={{ marginBottom: '8px' }}>Most Recurrent Feedbacks & Issues</h2>
        <p className="md-typescale-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '20px' }}>
          Detailed breakdown of recurring feedback topics, their frequency, average customer rating, sentiment impact, and verbatim examples.
        </p>
        
        <div className="m3-table-container">
          <table className="m3-table">
            <thead>
              <tr>
                <th className="md-typescale-label-medium">Theme / Topic</th>
                <th className="md-typescale-label-medium" style={{ textAlign: 'center' }}>Frequency</th>
                <th className="md-typescale-label-medium" style={{ textAlign: 'center' }}>Avg Rating</th>
                <th className="md-typescale-label-medium" style={{ minWidth: '160px' }}>Sentiment Mix</th>
                <th className="md-typescale-label-medium">Representative Customer Verbatim</th>
              </tr>
            </thead>
            <tbody>
              {recurrentFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                     No feedback trends available.
                  </td>
                </tr>
              ) : (
                recurrentFeedbacks.map(({ theme, count, avgRating, positivePct, neutralPct, negativePct, snippet }) => (
                  <tr key={theme} onClick={() => handleThemeClick(theme)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: '500', textTransform: 'capitalize', color: 'var(--md-sys-color-primary)' }}>
                      {theme}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {count}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {avgRating !== 'N/A' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          {avgRating} <md-icon style={{ fontSize: '14px', color: 'var(--md-sys-color-tertiary)', verticalAlign: 'middle' }}>star</md-icon>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--md-sys-color-outline)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          display: 'flex',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          backgroundColor: 'var(--md-sys-color-surface-container)'
                        }}>
                          {positivePct > 0 && <div style={{ width: `${positivePct}%`, backgroundColor: 'var(--sentiment-positive)' }} />}
                          {neutralPct > 0 && <div style={{ width: `${neutralPct}%`, backgroundColor: 'var(--sentiment-neutral)' }} />}
                          {negativePct > 0 && <div style={{ width: `${negativePct}%`, backgroundColor: 'var(--sentiment-negative)' }} />}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                          <span>{positivePct}% Pos</span>
                          <span>{negativePct}% Neg</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--md-sys-color-on-surface-variant)', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={snippet}>
                      "{snippet}"
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .analytics-card {
          border: 1px solid var(--md-sys-color-outline-variant);
          border-radius: 16px;
          background-color: var(--md-sys-color-surface);
          padding: 20px;
        }
        .analytics-title {
          font-family: var(--md-sys-typescale-title-large-font);
          font-size: var(--md-sys-typescale-title-large-size);
          font-weight: var(--md-sys-typescale-title-large-weight);
          line-height: var(--md-sys-typescale-title-large-line-height);
          letter-spacing: var(--md-sys-typescale-title-large-tracking);
          color: var(--md-sys-color-on-background);
        }
        .theme-breakdown-card:hover {
          border-color: var(--md-sys-color-primary) !important;
          background-color: var(--md-sys-color-surface-container-low) !important;
        }
        @media (max-width: 800px) {
          .analytics-top-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
