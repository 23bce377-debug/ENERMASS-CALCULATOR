'use server';

import { createClient } from '@/lib/supabase/server';
import { requireLicensedPage } from '@/lib/auth/requireLicensedPage';

export async function saveDraftQuote(params: {
  draftId: string | null;
  calculatorState: string;
  systemName: string;
  systemKw: number;
  estimatedTotal: number;
}) {
  const session = await requireLicensedPage({
    feature: 'calculator',
    roles: ['owner', 'admin', 'manager', 'staff'],
  });
  const { orgId, user } = session;
  const supabase = await createClient();

  if (params.draftId) {
    const { error } = await supabase
      .from('draft_quotes' as any)
      .update({
        state_json: JSON.parse(params.calculatorState),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.draftId)
      .eq('user_id', user.id);

    if (error) throw new Error(`Failed to update draft: ${error.message}`);
    return { draftId: params.draftId };
  } else {
    const { data, error } = await supabase
      .from('draft_quotes' as any)
      .upsert({
        org_id: orgId,
        user_id: user.id,
        state_json: JSON.parse(params.calculatorState),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to insert draft: ${error.message}`);
    if (!data) throw new Error('Failed to insert draft: no data returned');
    return { draftId: (data as any).id };
  }
}
