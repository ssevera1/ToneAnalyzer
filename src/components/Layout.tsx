import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
  onExport?: () => void;
}

export default function Layout({ children, onExport }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-900" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed z-40 p-2 bg-dark-800 rounded-lg border border-dark-600 md:hidden left-3"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
        aria-label="Open menu"
      >
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <Sidebar
        onExport={onExport}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
