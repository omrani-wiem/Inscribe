import React from 'react';
import { FeedbackRecord } from '../types';

interface ChartProps {
  data: FeedbackRecord[];
}

// 1. Stacked Bar Chart for Sentiment History — native HTML/CSS (no SVG)
export function SentimentHistoryChart({ data }: ChartProps) {
  // Group feedback by day-of-week
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const sentimentByDay = days.map((day, idx) => {
    const dayData = data.filter(item => {
      const date = new Date(item.timestamp);
      const dayIndex = (date.getDay() + 6) % 7; // Mon=0, Sun=6
      return dayIndex === idx;
    });

    const pos = dayData.filter(i => i.sentiment === 'positive').length;
    const neu = dayData.filter(i => i.sentiment === 'neutral').length;
    const neg = dayData.filter(i => i.sentiment === 'negative').length;

    return { day, pos, neu, neg, total: pos + neu + neg };
  });

  const maxTotal = Math.max(...sentimentByDay.map(d => d.total), 1);
  const CHART_HEIGHT = 200;
  const Y_LABEL_WIDTH = 32;

  // Grid line values (even increments based on maxTotal)
  const gridSteps = 4;
  const gridValues = Array.from({ length: gridSteps + 1 }, (_, i) => Math.round((maxTotal / gridSteps) * i));

  return (
    <div style={{ width: '100%' }}>
      {/* Legend */}
      <div className="md-typescale-label-small" style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginBottom: '12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--sentiment-positive)' }} /> Positive
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--sentiment-neutral)' }} /> Neutral
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--sentiment-negative)' }} /> Negative
        </span>
      </div>

      {/* Chart body */}
      <div style={{ position: 'relative', height: `${CHART_HEIGHT + 28}px` }}>
        {/* Grid lines layer */}
        {gridValues.map((val, i) => {
          const y = CHART_HEIGHT - (val / maxTotal) * CHART_HEIGHT;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${y}px`,
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none'
              }}
            >
              <span
                style={{
                  width: `${Y_LABEL_WIDTH}px`,
                  fontSize: '10px',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  textAlign: 'right',
                  paddingRight: '8px',
                  flexShrink: 0
                }}
              >
                {val}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  borderTop: '1px dashed var(--md-sys-color-outline-variant)'
                }}
              />
            </div>
          );
        })}

        {/* Bars layer */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            left: `${Y_LABEL_WIDTH}px`,
            right: 0,
            height: `${CHART_HEIGHT}px`,
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px'
          }}
        >
          {sentimentByDay.map((dayData, idx) => {
            const totalHeight = maxTotal > 0 ? (dayData.total / maxTotal) * 100 : 0;

            // Percentage each segment contributes to this bar
            const pctNeg = dayData.total > 0 ? (dayData.neg / dayData.total) * 100 : 0;
            const pctNeu = dayData.total > 0 ? (dayData.neu / dayData.total) * 100 : 0;
            const pctPos = dayData.total > 0 ? (dayData.pos / dayData.total) * 100 : 0;

            return (
              <div
                key={idx}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end'
                }}
              >
                {/* Bar stack */}
                <div
                  title={`${dayData.day}: ${dayData.pos} pos · ${dayData.neu} neu · ${dayData.neg} neg`}
                  style={{
                    width: '100%',
                    maxWidth: '48px',
                    height: totalHeight > 0 ? `${totalHeight}%` : '4px',
                    minHeight: dayData.total > 0 ? '4px' : '2px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    transition: 'height var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)',
                    opacity: dayData.total > 0 ? 1 : 0.3,
                    backgroundColor: dayData.total === 0 ? 'var(--md-sys-color-outline-variant)' : 'transparent'
                  }}
                >
                  {dayData.neg > 0 && (
                    <div
                      style={{
                        height: `${pctNeg}%`,
                        backgroundColor: 'var(--sentiment-negative)',
                        transition: 'height var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
                      }}
                    />
                  )}
                  {dayData.neu > 0 && (
                    <div
                      style={{
                        height: `${pctNeu}%`,
                        backgroundColor: 'var(--sentiment-neutral)',
                        transition: 'height var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
                      }}
                    />
                  )}
                  {dayData.pos > 0 && (
                    <div
                      style={{
                        height: `${pctPos}%`,
                        backgroundColor: 'var(--sentiment-positive)',
                        transition: 'height var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
                      }}
                    />
                  )}
                </div>

                {/* Day label */}
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--md-sys-color-on-surface-variant)',
                    fontWeight: '500',
                    marginTop: '8px',
                    lineHeight: 1
                  }}
                >
                  {dayData.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 2. Horizontal Bar Chart for Top Themes
interface TopThemesChartProps extends ChartProps {
  onThemeClick?: (theme: string) => void;
}

export function TopThemesChart({ data, onThemeClick }: TopThemesChartProps) {
  // Count frequency of themes
  const themeCounts: Record<string, number> = {};
  data.forEach(item => {
    item.themes.forEach(theme => {
      const trimmed = theme.toLowerCase().trim();
      if (trimmed) {
        themeCounts[trimmed] = (themeCounts[trimmed] || 0) + 1;
      }
    });
  });

  const sortedThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7); // Show top 7 themes

  const maxCount = Math.max(...sortedThemes.map(t => t[1]), 1);

  if (sortedThemes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--md-sys-color-on-surface-variant)' }}>
        No themes extracted yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {sortedThemes.map(([theme, count]) => {
        const percentage = (count / maxCount) * 100;
        return (
          <div
            key={theme}
            onClick={() => onThemeClick && onThemeClick(theme)}
            style={{
              cursor: onThemeClick ? 'pointer' : 'default',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '6px 8px',
              borderRadius: '8px',
              transition: 'background-color var(--md-sys-motion-duration-short3) var(--md-sys-motion-easing-standard)'
            }}
            className="theme-bar-row"
          >
            <div className="md-typescale-body-medium" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: '500', textTransform: 'capitalize', color: 'var(--md-sys-color-on-surface)' }}>
                {theme}
              </span>
              <span style={{ color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 'bold' }}>
                {count} mention{count !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '10px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${percentage}%`,
                height: '100%',
                backgroundColor: 'var(--md-sys-color-primary)',
                borderRadius: '10px',
                transition: 'width var(--md-sys-motion-duration-long1) var(--md-sys-motion-easing-emphasized)'
              }} />
            </div>
          </div>
        );
      })}
      <style>{`
        .theme-bar-row:hover {
          background-color: var(--md-sys-color-surface-container-low);
        }
      `}</style>
    </div>
  );
}

// 3. 5-Bar Histogram for Rating Distribution (1★–5★)
export function RatingDistributionChart({ data }: ChartProps) {
  const ratings = [5, 4, 3, 2, 1];
  const distribution = ratings.map(star => {
    const count = data.filter(item => item.rating === star).length;
    return { star, count };
  });

  const maxCount = Math.max(...distribution.map(d => d.count), 1);
  const totalWithRating = data.filter(item => item.rating !== null).length || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {distribution.map(({ star, count }) => {
        const percentage = (count / maxCount) * 100;
        const pctOfTotal = Math.round((count / totalWithRating) * 100);
        return (
          <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 'bold',
              minWidth: '24px',
              color: 'var(--md-sys-color-tertiary)',
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              {star}★
            </span>
            <div style={{
              flex: 1,
              height: '10px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${percentage}%`,
                height: '100%',
                backgroundColor: 'var(--md-sys-color-tertiary)',
                borderRadius: '10px',
                transition: 'width var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
              }} />
            </div>
            <span style={{
              fontSize: '0.8rem',
              minWidth: '50px',
              textAlign: 'right',
              color: 'var(--md-sys-color-on-surface-variant)'
            }}>
              {count} ({pctOfTotal}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

// 4. Segmented Sentiment Progress Bar
export function SegmentedSentimentBar({ data }: ChartProps) {
  const total = data.length || 1;
  const pos = data.filter(i => i.sentiment === 'positive').length;
  const neu = data.filter(i => i.sentiment === 'neutral').length;
  const neg = data.filter(i => i.sentiment === 'negative').length;

  const pctPos = (pos / total) * 100;
  const pctNeu = (neu / total) * 100;
  const pctNeg = (neg / total) * 100;

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        width: '100%',
        height: '16px',
        display: 'flex',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'var(--md-sys-color-surface-container)'
      }}>
        {pos > 0 && (
          <div style={{
            width: `${pctPos}%`,
            backgroundColor: 'var(--sentiment-positive)',
            transition: 'width var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
          }} title={`Positive: ${pos}`} />
        )}
        {neu > 0 && (
          <div style={{
            width: `${pctNeu}%`,
            backgroundColor: 'var(--sentiment-neutral)',
            transition: 'width var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
          }} title={`Neutral: ${neu}`} />
        )}
        {neg > 0 && (
          <div style={{
            width: `${pctNeg}%`,
            backgroundColor: 'var(--sentiment-negative)',
            transition: 'width var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
          }} title={`Negative: ${neg}`} />
        )}
      </div>
    </div>
  );
}

// ─── Time-Series Line Chart ───────────────────────────────────────────────────
export function TimeSeriesChart({ data }: ChartProps) {
  const W = 560, H = 200, PAD = { top: 16, right: 16, bottom: 32, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // Group by day (last 30 days)
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(d.toISOString().split('T')[0]);
  }

  const byDay = days.map(dayStr => {
    const items = data.filter(r => r.timestamp.startsWith(dayStr));
    return {
      day: dayStr,
      pos: items.filter(r => r.sentiment === 'positive').length,
      neu: items.filter(r => r.sentiment === 'neutral').length,
      neg: items.filter(r => r.sentiment === 'negative').length,
    };
  });

  const maxVal = Math.max(1, ...byDay.map(d => Math.max(d.pos, d.neu, d.neg)));
  const xScale = (i: number) => PAD.left + (i / (days.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const polyline = (values: number[], color: string) => {
    const pts = values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
    return <polyline key={color} points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />;
  };

  // Show only every 5th day label
  const dayLabels = days.filter((_, i) => i === 0 || i === days.length - 1 || i % 6 === 0);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginBottom: '8px' }} className="md-typescale-label-small">
        {[['var(--sentiment-positive)', 'Positive'], ['var(--sentiment-neutral)', 'Neutral'], ['var(--sentiment-negative)', 'Negative']].map(([color, label]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 10, height: 3, backgroundColor: color, display: 'inline-block', borderRadius: 2 }} /> {label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = PAD.top + innerH * (1 - frac);
          return (
            <g key={frac}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" strokeDasharray="4,3" />
              <text x={PAD.left - 4} y={y + 4} fontSize="9" textAnchor="end" fill="var(--md-sys-color-on-surface-variant)">{Math.round(frac * maxVal)}</text>
            </g>
          );
        })}
        {/* Lines */}
        {polyline(byDay.map(d => d.pos), 'var(--sentiment-positive)')}
        {polyline(byDay.map(d => d.neu), 'var(--sentiment-neutral)')}
        {polyline(byDay.map(d => d.neg), 'var(--sentiment-negative)')}
        {/* X axis labels */}
        {dayLabels.map(day => {
          const i = days.indexOf(day);
          return (
            <text key={day} x={xScale(i)} y={H - 4} fontSize="9" textAnchor="middle" fill="var(--md-sys-color-on-surface-variant)">
              {day.slice(5)} {/* MM-DD */}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Word Cloud (pure SVG) ────────────────────────────────────────────────────
const STOPWORDS = new Set(['the','a','an','and','or','but','in','on','at','to','of','for','is','was','are','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','with','from','that','this','these','those','it','its','they','them','their','we','our','you','your','he','she','his','her','i','my','me','by','not','no','so','as','if','about','after','before','during','through','over','under','into','out','up','down']);

export function WordCloudChart({ data }: ChartProps) {
  const freq: Record<string, number> = {};
  data.forEach(r => {
    r.transcription.toLowerCase().split(/[\s.,!?;:()\"'']+/).forEach(w => {
      const clean = w.replace(/[^a-z]/g, '');
      if (clean.length > 3 && !STOPWORDS.has(clean)) {
        freq[clean] = (freq[clean] ?? 0) + 1;
      }
    });
  });

  const words = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 40);
  if (words.length === 0) return <p style={{ color: 'var(--md-sys-color-on-surface-variant)', textAlign: 'center' }}>Not enough data yet.</p>;

  const maxFreq = words[0][1];
  const minFreq = words[words.length - 1][1];
  const sizeFor = (freq: number) => {
    const t = maxFreq === minFreq ? 0.5 : (freq - minFreq) / (maxFreq - minFreq);
    return 12 + t * 28;
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 14px', padding: '16px', justifyContent: 'center', alignItems: 'center', minHeight: '160px' }}>
      {words.map(([word, count]) => {
        const size = sizeFor(count);
        const opacity = 0.5 + (count / maxFreq) * 0.5;
        return (
          <span key={word} title={`${count} occurrences`} style={{
            fontSize: `${size}px`, lineHeight: 1.2,
            color: 'var(--md-sys-color-primary)',
            opacity,
            fontWeight: size > 28 ? '700' : size > 18 ? '600' : '400',
            cursor: 'default',
            transition: 'opacity 0.2s',
            userSelect: 'none',
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ─── Theme Trend (stacked bar by week) ───────────────────────────────────────
export function ThemeTrendChart({ data }: ChartProps) {
  // Build weeks (last 8)
  const now = new Date();
  const weeks: string[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date(now);
    start.setDate(start.getDate() - w * 7);
    weeks.push(start.toISOString().split('T')[0]);
  }

  // Top 5 themes across all data
  const themeCount: Record<string, number> = {};
  data.forEach(r => r.themes.forEach(t => { themeCount[t] = (themeCount[t] ?? 0) + 1; }));
  const topThemes = Object.entries(themeCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

  if (topThemes.length === 0) return <p style={{ color: 'var(--md-sys-color-on-surface-variant)', textAlign: 'center' }}>No theme data yet.</p>;

  const COLORS = ['var(--md-sys-color-primary)', 'var(--sentiment-positive)', 'var(--sentiment-neutral)', 'var(--sentiment-negative)', 'var(--md-sys-color-secondary)'];

  const getWeekOf = (ts: string) => {
    const d = new Date(ts);
    // Find closest week start
    for (let w = 0; w < weeks.length - 1; w++) {
      if (d >= new Date(weeks[w]) && d < new Date(weeks[w + 1])) return weeks[w];
    }
    if (d >= new Date(weeks[weeks.length - 1])) return weeks[weeks.length - 1];
    return null;
  };

  const weekData = weeks.map(week => {
    const items = data.filter(r => getWeekOf(r.timestamp) === week);
    const counts: Record<string, number> = {};
    topThemes.forEach(t => { counts[t] = items.filter(r => r.themes.includes(t)).length; });
    return { week, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
  });

  const maxTotal = Math.max(1, ...weekData.map(w => w.total));
  const BAR_H = 180;

  return (
    <div style={{ width: '100%' }}>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginBottom: '12px' }} className="md-typescale-label-small">
        {topThemes.map((t, i) => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 10, height: 10, backgroundColor: COLORS[i], display: 'inline-block', borderRadius: 2 }} /> {t}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: `${BAR_H + 28}px`, overflowX: 'auto' }}>
        {weekData.map(({ week, counts, total }) => {
          const barH = total > 0 ? (total / maxTotal) * BAR_H : 0;
          return (
            <div key={week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '36px' }}>
              <div style={{ width: '100%', height: `${BAR_H}px`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', height: `${barH}px`, display: 'flex', flexDirection: 'column', borderRadius: '4px 4px 0 0', overflow: 'hidden' }}>
                  {topThemes.map((t, i) => {
                    const pct = total > 0 ? (counts[t] / total) * 100 : 0;
                    return pct > 0 ? (
                      <div key={t} style={{ width: '100%', flex: `0 0 ${pct}%`, backgroundColor: COLORS[i] }} title={`${t}: ${counts[t]}`} />
                    ) : null;
                  })}
                </div>
              </div>
              <span style={{ fontSize: '8px', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px', textAlign: 'center' }}>
                {week.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
