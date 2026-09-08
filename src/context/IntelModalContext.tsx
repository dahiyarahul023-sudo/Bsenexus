import React, { createContext, useContext, useState, useEffect } from 'react';

interface StockIntelData {
  scripCode?: string;
  symbol?: string;
  companyName?: string;
}

interface IntelModalContextType {
  isIntelModalOpen: boolean;
  selectedStock: StockIntelData;
  openIntelModal: (data: StockIntelData) => void;
  closeIntelModal: () => void;
}

const IntelModalContext = createContext<IntelModalContextType | undefined>(undefined);

export function IntelModalProvider({ children }: { children: React.ReactNode }) {
  const [isIntelModalOpen, setIsIntelModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockIntelData>({});

  const openIntelModal = (data: StockIntelData) => {
    setSelectedStock(data);
    setIsIntelModalOpen(true);
  };

  const closeIntelModal = () => {
    setIsIntelModalOpen(false);
  };

  // Keep window event listener for backward compatibility
  useEffect(() => {
    const handleWindowEvent = (e: any) => {
      if (e.detail) {
        openIntelModal({
          scripCode: e.detail.scripCode,
          symbol: e.detail.symbol,
          companyName: e.detail.companyName
        });
      }
    };
    window.addEventListener('open-company-intel', handleWindowEvent);
    return () => window.removeEventListener('open-company-intel', handleWindowEvent);
  }, []);

  return (
    <IntelModalContext.Provider value={{ isIntelModalOpen, selectedStock, openIntelModal, closeIntelModal }}>
      {children}
    </IntelModalContext.Provider>
  );
}

export function useIntelModal() {
  const context = useContext(IntelModalContext);
  if (!context) {
    throw new Error('useIntelModal must be used within an IntelModalProvider');
  }
  return context;
}
