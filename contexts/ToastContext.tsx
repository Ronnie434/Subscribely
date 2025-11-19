import React, { createContext, useContext, useState, ReactNode } from 'react';
import Toast, { ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
  });

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    setToast({
      visible: true,
      message,
      type,
      duration,
    });
  };

  const showSuccess = (message: string, duration: number = 3000) => {
    showToast(message, 'success', duration);
  };

  const showError = (message: string, duration: number = 3000) => {
    showToast(message, 'error', duration);
  };

  const showInfo = (message: string, duration: number = 3000) => {
    showToast(message, 'info', duration);
  };

  const showWarning = (message: string, duration: number = 3000) => {
    showToast(message, 'warning', duration);
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showInfo,
        showWarning,
      }}
    >
      {children}
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onHide={hideToast}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}