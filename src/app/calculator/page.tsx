import { Suspense } from 'react';
import CalculatorContent from './CalculatorContent';
import CalculatorLoading from './loading';

export const metadata = {
  title: 'Calculator | EnerMass',
  description: 'Configure system parameters and generate accurate quotes.',
};

export default function Page() {
  return (
    <Suspense fallback={<CalculatorLoading />}>
      <CalculatorContent />
    </Suspense>
  );
}
