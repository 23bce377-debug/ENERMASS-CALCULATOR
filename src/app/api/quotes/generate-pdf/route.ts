import { NextResponse } from 'next/server';
import { withLicensedApiRoute } from '@/lib/auth/withLicensedApiRoute';
import { generateQuotePdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for chromium-min binary download on cold start

export const POST = withLicensedApiRoute(async (request, context) => {
  const { orgId } = context.session;
  
  if (!orgId) {
    return NextResponse.json(
      { error: 'Unauthorized: No org_id associated with profile' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { quoteId, download } = body;

    if (!quoteId) {
      return NextResponse.json(
        { error: 'Bad Request: quoteId is required in the body' },
        { status: 400 }
      );
    }

    console.log(`[API generate-pdf] Triggering PDF generation for quote ${quoteId} (Org: ${orgId}, download: ${!!download})`);
    
    // Call the orchestrator to fetch DB data, compile template, render via Chromium, and upload
    const { pdfBuffer, signedUrl } = await generateQuotePdf(quoteId, orgId);

    if (download) {
      return new Response(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${quoteId}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    }

    return NextResponse.json({
      success: true,
      signedUrl,
      message: 'PDF generated and uploaded successfully'
    }, { status: 200 });

  } catch (err: any) {
    console.error('[API generate-pdf] Error generating PDF:', err);
    return NextResponse.json({
      error: 'Failed to generate PDF',
      message: err.message || 'Internal server error'
    }, { status: 500 });
  }
}, {
  feature: 'calculator',
  roles: ['owner', 'admin', 'manager', 'staff']
});
