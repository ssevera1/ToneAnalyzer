import { useState } from 'react';

interface ModelLoadingOverlayProps {
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export default function ModelLoadingOverlay({ isLoading, error, onRetry }: ModelLoadingOverlayProps) {
  if (!isLoading && !error) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-dark-900/80 z-10 rounded-lg">
      {error ? (
        <div className="text-center">
          <svg className="w-10 h-10 text-accent-red mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-accent-red mb-2">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1.5 bg-dark-700 text-white rounded text-sm hover:bg-dark-600 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-dark-300">Loading models...</p>
        </div>
      )}
    </div>
  );
}
