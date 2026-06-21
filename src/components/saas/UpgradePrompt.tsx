import Link from 'next/link';
import { Lock } from 'lucide-react';
import { buttonClass } from './ManagementUi';

export function UpgradePrompt({ featureName }: { featureName?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center animate-fade-in">
      <div className="p-4 rounded-full bg-accent/10 text-accent mb-4">
        <Lock size={32} />
      </div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">Feature Locked</h2>
      <p className="text-text-muted max-w-md mx-auto mb-6">
        The {featureName ? <span className="font-semibold text-text-primary">"{featureName}"</span> : 'requested'} feature is not included in your current subscription plan. 
        Upgrade your plan to unlock advanced capabilities.
      </p>
      <Link href="/settings/subscription" className={buttonClass}>
        View Subscription Plans
      </Link>
    </div>
  );
}
