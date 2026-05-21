'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

export default function Toast() {
  const { toast, clearToast } = useApp();

  if (toast.type === 'none') return null;

  const bgStyles = {
    loading: 'border-purple-500/30 bg-gray-900/90 text-purple-200 shadow-purple-500/10',
    success: 'border-emerald-500/30 bg-gray-900/90 text-emerald-200 shadow-emerald-500/10',
    error: 'border-red-500/30 bg-gray-900/90 text-red-200 shadow-red-500/10',
  };

  const icons = {
    loading: <Loader2 className="w-5 h-5 text-purple-400 animate-spin mr-3 flex-shrink-0" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-3 flex-shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0" />,
  };

  return (
    <div className="fixed top-6 right-6 z-50 max-w-sm animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`flex items-center p-4 rounded-xl border backdrop-blur-md shadow-lg ${bgStyles[toast.type as keyof typeof bgStyles]}`}>
        {icons[toast.type as keyof typeof icons]}
        <div className="text-sm font-medium mr-4 flex-1">
          {toast.message}
        </div>
        {toast.type !== 'loading' && (
          <button 
            onClick={clearToast}
            className="text-gray-400 hover:text-gray-200 focus:outline-none transition-colors"
          >
            <span className="sr-only">닫기</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
