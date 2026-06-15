import { AlertTriangle, Lock, Check } from 'lucide-react';
import type { ValidationResult } from '@/lib/validation/systemValidation';

interface ValidationPanelProps {
  results: ValidationResult[];
  acknowledgedGuards: string[];
  onAcknowledge: (guardId: string) => void;
}

export function ValidationPanel({ results, acknowledgedGuards, onAcknowledge }: ValidationPanelProps) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-3 mt-6 animate-fade-in">
      <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-2">
        System Validation
      </h3>
      {results.map((res) => {
        const isBlocking = res.severity === 'blocking';
        const isAcknowledged = acknowledgedGuards.includes(res.guardId);
        
        // Don't show acknowledged advisories here, or show them as muted. 
        // We'll show them as a smaller check-marked item if acknowledged.
        if (isAcknowledged && !isBlocking) {
          return (
            <div key={res.guardId} className="flex items-start gap-3 p-3 rounded-xl border border-success/20 bg-success/5 text-success">
              <Check className="shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium">Acknowledged: {res.message}</p>
              </div>
            </div>
          );
        }

        return (
          <div 
            key={res.guardId} 
            className={`flex items-start gap-3 p-4 rounded-xl border ${
              isBlocking 
                ? 'bg-error/10 border-error/20 text-error' 
                : 'bg-warning/10 border-warning/20 text-warning-dark'
            }`}
          >
            {isBlocking ? <Lock className="shrink-0 mt-0.5" size={20} /> : <AlertTriangle className="shrink-0 mt-0.5" size={20} />}
            <div className="flex-1">
              <p className="font-bold text-sm mb-1">
                {isBlocking ? 'Blocking Configuration Issue' : 'Configuration Advisory'}
              </p>
              <p className="text-sm leading-relaxed text-text-primary mb-2">
                {res.message}
              </p>
              {res.suggestion && (
                <p className={`text-sm font-medium ${isBlocking ? 'text-error' : 'text-warning-dark'}`}>
                  Suggestion: {res.suggestion}
                </p>
              )}
            </div>
            {!isBlocking && (
              <button
                type="button"
                onClick={() => onAcknowledge(res.guardId)}
                className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-warning/20 hover:bg-warning/30 transition-colors text-warning-dark"
              >
                Acknowledge
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
