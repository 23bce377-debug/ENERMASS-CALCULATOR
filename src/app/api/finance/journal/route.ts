import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/wrappers';
import { journalEntrySchema, postJournalEntry } from '@/lib/finance/ledger';

export const POST = withAuth(async (request, context) => {
  const { orgId } = context.auth;
  if (!orgId) {
    return NextResponse.json({ error: 'Unauthorized: No org_id associated with profile' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Validate payload against double-entry accounting rules
    const parseResult = journalEntrySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ 
        error: 'Invalid journal entry payload', 
        details: parseResult.error.format() 
      }, { status: 400 });
    }

    // Post to ledger
    const entryId = await postJournalEntry(orgId, parseResult.data);

    return NextResponse.json({ 
      success: true, 
      entry_id: entryId,
      message: 'Journal entry posted successfully'
    }, { status: 201 });

  } catch (error: any) {
    console.error('[API] Error posting journal entry:', error);
    return NextResponse.json({ 
      error: 'Failed to post journal entry',
      message: error.message
    }, { status: 500 });
  }
});
