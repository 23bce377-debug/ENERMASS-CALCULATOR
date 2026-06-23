import { Loader2 } from 'lucide-react';

export default function CalculatorLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <div className="text-sm font-medium text-gray-400">Loading calculator data...</div>
      </div>
    </div>
  );
}
