import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Overview from './pages/Overview';
import Analytics from './pages/Analytics';
import Analyzer from './pages/Analyzer';
import FeedbackTable from './pages/FeedbackTable';
import Settings from './pages/Settings';
import Integrations from './pages/Integrations';
import { useFeedbackStore } from './store';
import { FeedbackRecord } from './types';

export default function App() {
  const {
    feedbackList,
    settings,
    queue,
    isProcessing,
    saveSettings,
    clearAllData,
    loadSampleData,
    addFeedback,
    updateFeedback,
    deleteFeedback,
    deleteMultipleFeedback,
    addToQueue,
    removeFromQueue,
    clearQueue,
    analyzeBatch,
    addTag,
    removeTag,
    reAnalyzeFeedback,
    generateAutoReply,
    detectDuplicates
  } = useFeedbackStore();

  // Sync dark mode with document class on mount and toggle
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Run duplicate detection on load/data changes
  useEffect(() => {
    if (feedbackList.length > 0) {
      detectDuplicates();
    }
  }, [feedbackList.length]);

  const [currentTab, setTab] = useState('overview');
  
  // Filtering & search states shared or passed
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRecord | null>(null);

  // Compute needsReview count for sidebar badge
  const needsReviewCount = useMemo(() => {
    return feedbackList.filter(item => item.needsReview).length;
  }, [feedbackList]);

  // Compute breadcrumbs and title
  const { title, breadcrumbs } = useMemo(() => {
    switch (currentTab) {
      case 'overview':
        return { title: 'Feedback Overview', breadcrumbs: 'Overview' };
      case 'analytics':
        return { title: 'Theme & Sentiment Analytics', breadcrumbs: 'Analytics' };
      case 'table':
        return { title: 'All Feedback Entries', breadcrumbs: 'Feedback Table' };
      case 'analyzer':
        return { title: 'Handwriting OCR Analyzer', breadcrumbs: 'Analyzer' };
      case 'integrations':
        return { title: 'Integrations & Webhooks', breadcrumbs: 'Integrations' };
      case 'settings':
        return { title: 'Dashboard Settings', breadcrumbs: 'Settings' };
      default:
        return { title: 'InkScribe AI', breadcrumbs: 'Home' };
    }
  }, [currentTab]);

  // Apply Date and Segment Filters globally
  const filteredData = useMemo(() => {
    return feedbackList.filter(item => {
      // 1. Segment filter
      if (selectedSegment === 'positive' && item.sentiment !== 'positive') return false;
      if (selectedSegment === 'neutral' && item.sentiment !== 'neutral') return false;
      if (selectedSegment === 'negative' && item.sentiment !== 'negative') return false;
      if (selectedSegment === 'review' && !item.needsReview) return false;

      // 2. Date filter
      if (dateRange === 'custom') {
        const itemTime = new Date(item.timestamp).getTime();
        if (customDateStart && itemTime < new Date(customDateStart).getTime()) return false;
        if (customDateEnd && itemTime > new Date(customDateEnd).getTime() + 86400000) return false;
      } else if (dateRange !== 'all') {
        const itemTime = new Date(item.timestamp).getTime();
        const now = Date.now();
        let daysLimit = 0;
        if (dateRange === '7d') daysLimit = 7;
        else if (dateRange === '30d') daysLimit = 30;
        else if (dateRange === '90d') daysLimit = 90;

        if (now - itemTime > daysLimit * 24 * 60 * 60 * 1000) {
          return false;
        }
      }

      return true;
    });
  }, [feedbackList, selectedSegment, dateRange, customDateStart, customDateEnd]);

  const renderPageContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <Overview
            data={filteredData}
            setTab={setTab}
            setSelectedFeedback={handleOpenFeedbackDetails}
          />
        );
      case 'analytics':
        return (
          <Analytics
            data={filteredData}
            setTab={setTab}
            setThemeFilter={setThemeFilter}
            alertThreshold={settings.alertThreshold}
          />
        );
      case 'table':
        return (
          <FeedbackTable
            data={filteredData}
            updateFeedback={updateFeedback}
            deleteFeedback={deleteFeedback}
            deleteMultipleFeedback={deleteMultipleFeedback}
            themeFilter={themeFilter}
            setThemeFilter={setThemeFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedFeedback={selectedFeedback}
            setSelectedFeedback={setSelectedFeedback}
            addTag={addTag}
            removeTag={removeTag}
            reAnalyzeFeedback={reAnalyzeFeedback}
            generateAutoReply={generateAutoReply}
          />
        );
      case 'analyzer':
        return (
          <Analyzer
            queue={queue}
            isProcessing={isProcessing}
            addToQueue={addToQueue}
            removeFromQueue={removeFromQueue}
            clearQueue={clearQueue}
            analyzeBatch={analyzeBatch}
            addFeedback={addFeedback}
            updateFeedback={updateFeedback}
          />
        );
      case 'integrations':
        return (
          <Integrations
            feedbackList={feedbackList}
            addFeedback={addFeedback}
            emailJsConfig={settings.emailJsConfig}
            saveEmailJsConfig={(cfg) => saveSettings({ ...settings, emailJsConfig: cfg })}
          />
        );
      case 'settings':
        return (
          <Settings
            settings={settings}
            saveSettings={saveSettings}
            clearAllData={clearAllData}
            loadSampleData={loadSampleData}
            feedbackList={feedbackList}
          />
        );
      default:
        return null;
    }
  };

  const handleOpenFeedbackDetails = (item: FeedbackRecord | null) => {
    setSelectedFeedback(item);
    setTab('table');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      
      {/* Sidebar navigation */}
      <Sidebar
        currentTab={currentTab}
        setTab={setTab}
        needsReviewCount={needsReviewCount}
      />

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        paddingBottom: '80px' // spacing for mobile bottom navigation height
      }}>
        <TopBar
          title={title}
          breadcrumbs={breadcrumbs}
          selectedSegment={selectedSegment}
          setSelectedSegment={setSelectedSegment}
          dateRange={dateRange}
          setDateRange={setDateRange}
          onSearchChange={setSearchQuery}
          customDateStart={customDateStart}
          customDateEnd={customDateEnd}
          setCustomDateStart={setCustomDateStart}
          setCustomDateEnd={setCustomDateEnd}
        />

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderPageContent()}
        </div>
      </main>
    </div>
  );
}
