import { ForceView } from '@/components/force-view';

/** /designer always uses Analyst styling and has no Board version (DESIGN-v2 §1). */
export default function DesignerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-view="analyst"
      className="min-h-screen bg-ground text-text"
      style={{ backgroundImage: 'var(--ground-texture)', backgroundSize: 'var(--ground-texture-size)' }}
    >
      <ForceView view="analyst" />
      {children}
    </div>
  );
}
