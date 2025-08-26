import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppState {
  showSettings: boolean;
  showHistory: boolean;
  showAnnouncement: boolean;
}

interface AppContextType {
  // State
  showSettings: boolean;
  showHistory: boolean;
  showAnnouncement: boolean;
  
  // Actions
  navigateToHistory: () => void;
  hideHistory: () => void;
  showSettingsView: () => void;
  hideSettings: () => void;
  setShowAnnouncement: (show: boolean) => void;
  hideAnnouncement: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    showSettings: false,
    showHistory: false,
    showAnnouncement: false,
  });

  const navigateToHistory = () => {
    setState(prev => ({
      ...prev,
      showHistory: true,
      showSettings: false,
    }));
  };

  const hideHistory = () => {
    setState(prev => ({
      ...prev,
      showHistory: false,
    }));
  };

  const showSettingsView = () => {
    setState(prev => ({
      ...prev,
      showSettings: true,
      showHistory: false,
    }));
  };

  const hideSettings = () => {
    setState(prev => ({
      ...prev,
      showSettings: false,
    }));
  };

  const setShowAnnouncement = (show: boolean) => {
    setState(prev => ({
      ...prev,
      showAnnouncement: show,
    }));
  };

  const hideAnnouncement = () => {
    setState(prev => ({
      ...prev,
      showAnnouncement: false,
    }));
  };

  const contextValue: AppContextType = {
    showSettings: state.showSettings,
    showHistory: state.showHistory,
    showAnnouncement: state.showAnnouncement,
    navigateToHistory,
    hideHistory,
    showSettingsView,
    hideSettings,
    setShowAnnouncement,
    hideAnnouncement,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};