import { ReactNode } from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: ReactNode;
  onExport?: () => void;
}

export default function Layout({ children, onExport }: LayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-900">
      <Sidebar onExport={onExport} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
