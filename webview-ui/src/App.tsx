import React from 'react';
import ChatView from './components/ChatView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import { AppProvider, useAppContext } from './context/AppContext';
import './index.css';

const AppContent: React.FC = () => {
  const {
    showSettings,
    showHistory,
    showAnnouncement,
    hideHistory,
    hideSettings,
    hideAnnouncement,
  } = useAppContext();


  return (
    <>
      {showSettings && <SettingsView onDone={hideSettings} />}
      {showHistory && <HistoryView onDone={hideHistory} />}
      
      {/* ChatView is always rendered to preserve state, but can be hidden */}
      <ChatView
        isHidden={showSettings || showHistory}
        showAnnouncement={showAnnouncement}
        hideAnnouncement={hideAnnouncement}
      />
    </>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
