import { Loader2 } from 'lucide-react';

export default function CalculatorLoading() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <div className="text-sm font-medium text-text-muted">Loading calculator data...</div>
      </div>
    </div>
  );
}
