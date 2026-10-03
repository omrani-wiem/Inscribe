import React, { useRef, useState, useEffect } from 'react';
import '@material/web/menu/menu.js';
import '@material/web/menu/menu-item.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/dialog/dialog.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';

interface TopBarProps {
  title: string;
  breadcrumbs: string;
  selectedSegment: string;
  setSelectedSegment: (segment: string) => void;
  dateRange: string;
  setDateRange: (range: string) => void;
  customDateStart: string;
  customDateEnd: string;
  setCustomDateStart: (date: string) => void;
  setCustomDateEnd: (date: string) => void;
  onSearchChange?: (search: string) => void;
}

export default function TopBar({
  title,
  breadcrumbs,
  selectedSegment,
  setSelectedSegment,
  dateRange,
  setDateRange,
  customDateStart,
  customDateEnd,
  setCustomDateStart,
  setCustomDateEnd,
  onSearchChange
}: TopBarProps) {
  const segmentAnchorRef = useRef<HTMLButtonElement>(null);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const segmentMenuRef = useRef<any>(null);
  const dateMenuRef = useRef<any>(null);
  const customDateDialogRef = useRef<any>(null);

  // Local state for the custom date dialog fields (before applying)
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [showCustomDialog, setShowCustomDialog] = useState(false);

  const segmentLabels: Record<string, string> = {
    all: 'All Segments',
    positive: 'Positive Sentiment',
    neutral: 'Neutral Sentiment',
    negative: 'Negative Sentiment',
    review: 'Needs Review'
  };

  const dateLabels: Record<string, string> = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    custom: 'Custom Range',
    all: 'All Time'
  };

  // Open the segment menu via Material Web API
  const openSegmentMenu = () => {
    if (segmentMenuRef.current && segmentAnchorRef.current) {
      segmentMenuRef.current.show(segmentAnchorRef.current);
    }
  };

  // Open the date menu via Material Web API
  const openDateMenu = () => {
    if (dateMenuRef.current && dateAnchorRef.current) {
      dateMenuRef.current.show(dateAnchorRef.current);
    }
  };

  // Open the custom date range dialog
  const openCustomDateDialog = () => {
    setDraftStart(customDateStart || '');
    setDraftEnd(customDateEnd || '');
    setShowCustomDialog(true);
  };

  // Effect to open the dialog when showCustomDialog becomes true
  useEffect(() => {
    if (showCustomDialog && customDateDialogRef.current) {
      customDateDialogRef.current.showModal();
    }
  }, [showCustomDialog]);

  // Handle dialog close event
  const handleDialogClose = () => {
    setShowCustomDialog(false);
  };

  // Apply the custom date range
  const applyCustomRange = () => {
    setCustomDateStart(draftStart);
    setCustomDateEnd(draftEnd);
    setDateRange('custom');
    customDateDialogRef.current?.close(); // triggers close event → handleDialogClose
  };

  // Listen for close event on the dialog
  useEffect(() => {
    const dialog = customDateDialogRef.current;
    if (!dialog) return;
    dialog.addEventListener('close', handleDialogClose);
    return () => dialog.removeEventListener('close', handleDialogClose);
  }, []);

  return (
    <header style={{
      padding: '16px 24px',
      backgroundColor: 'var(--md-sys-color-background)',
      borderBottom: '1px solid var(--md-sys-color-outline-variant)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Breadcrumb / Top utilities row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Breadcrumbs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--md-sys-color-on-surface-variant)'
        }}
        className="md-typescale-label-large"
      >
          <md-icon style={{ fontSize: '16px' }}>home</md-icon>
          <span>Dashboards</span>
          <span>/</span>
          <span style={{ color: 'var(--md-sys-color-primary)' }}>{breadcrumbs}</span>
        </div>

        {/* Global Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <md-icon style={{ position: 'absolute', left: '12px', fontSize: '18px', color: 'var(--md-sys-color-outline)' }}>search</md-icon>
            <input
              type="text"
              placeholder="Search feedback..."
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              style={{
                padding: '8px 12px 8px 36px',
                borderRadius: '20px',
                border: '1px solid var(--md-sys-color-outline-variant)',
                backgroundColor: 'var(--md-sys-color-surface)',
                color: 'var(--md-sys-color-on-surface)',
                fontSize: '0.85rem',
                width: '180px',
                outline: 'none',
                transition: 'width var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized)'
              }}
              onFocus={(e) => e.target.style.width = '240px'}
              onBlur={(e) => e.target.style.width = '180px'}
            />
          </div>
          <md-icon-button title="Notifications">
            <md-icon>notifications</md-icon>
          </md-icon-button>
          <md-icon-button title="Quick Help">
            <md-icon>help_outline</md-icon>
          </md-icon-button>
        </div>
      </div>

      {/* Main Title & Action Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h1 className="md-typescale-headline-medium" style={{ color: 'var(--md-sys-color-on-background)' }}>
          {title}
        </h1>

        {/* Date Filter & Segment Filter Button Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
          {/* Date Range Selector */}
          <md-outlined-button
            ref={dateAnchorRef}
            onClick={openDateMenu}
            style={{ minWidth: '150px', '--md-outlined-button-container-height': '40px' }}
          >
            <md-icon slot="icon">calendar_today</md-icon>
            {dateLabels[dateRange]}
            <md-icon slot="trailing-icon">expand_more</md-icon>
          </md-outlined-button>
          
          <md-menu
            ref={dateMenuRef}
            stay-open-on-outside-click={false}
          >
            {Object.entries(dateLabels).map(([key, label]) => (
              <md-menu-item
                key={key}
                onClick={() => {
                  if (key === 'custom') {
                    openCustomDateDialog();
                  } else {
                    setDateRange(key);
                  }
                }}
              >
                <div slot="headline">{label}</div>
              </md-menu-item>
            ))}
          </md-menu>

          {/* Segment Selector */}
          <md-filled-button
            ref={segmentAnchorRef}
            onClick={openSegmentMenu}
            style={{ minWidth: '150px', '--md-filled-button-container-height': '40px' }}
          >
            <md-icon slot="icon">filter_alt</md-icon>
            {segmentLabels[selectedSegment]}
            <md-icon slot="trailing-icon">expand_more</md-icon>
          </md-filled-button>
          
          <md-menu
            ref={segmentMenuRef}
            onClose={() => {}}
          >
            {Object.entries(segmentLabels).map(([key, label]) => (
              <md-menu-item
                key={key}
                onClick={() => {
                  setSelectedSegment(key);
                }}
              >
                <div slot="headline">{label}</div>
              </md-menu-item>
            ))}
          </md-menu>
        </div>
      </div>
      {/* Custom Date Range Dialog */}
      <md-dialog
        ref={customDateDialogRef}
        style={{ maxWidth: '400px', width: '90%' }}
      >
        <div slot="headline">Select Custom Date Range</div>

        <div slot="content" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '12px' }}>
          <md-outlined-text-field
            label="Start Date"
            type="date"
            value={draftStart}
            onInput={(e: any) => setDraftStart(e.target.value)}
            style={{ width: '100%' }}
          />
          <md-outlined-text-field
            label="End Date"
            type="date"
            value={draftEnd}
            min={draftStart || undefined}
            onInput={(e: any) => setDraftEnd(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div slot="actions" style={{ display: 'flex', gap: '8px' }}>
          <md-text-button onClick={() => { customDateDialogRef.current?.close(); }}>Cancel</md-text-button>
          <md-filled-button onClick={applyCustomRange}>Apply</md-filled-button>
        </div>
      </md-dialog>
    </header>
  );
}
