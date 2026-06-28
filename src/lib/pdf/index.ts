import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import './helpers';
import { buildQuoteViewModel } from './buildViewModel';
import { renderHtmlToPdf } from './renderPdf';
import { createAdminClient } from '@/lib/supabase/server';

export async function generateQuotePdf(quoteId: string, orgId: string): Promise<{ pdfBuffer: Buffer; signedUrl: string }> {
  console.log(`[pdfEngine] Starting PDF generation orchestrator for quote ID: ${quoteId}, Org: ${orgId}`);

  // 1. Build the view model from database tables
  const viewModel = await buildQuoteViewModel(quoteId, orgId);

  // 2. Read and compile the Handlebars template
  // We use path.join and process.cwd() to ensure the path resolves correctly in Vercel serverless functions
  const templatePath = path.join(process.cwd(), 'src', 'lib', 'pdf', 'templates', 'quote.hbs');
  console.log(`[pdfEngine] Loading Handlebars template from: ${templatePath}`);
  const source = await fs.readFile(templatePath, 'utf-8');
  
  const template = Handlebars.compile(source);
  const html = template(viewModel);

  // 3. Render HTML content to PDF buffer
  const pdfBuffer = await renderHtmlToPdf(html);
  console.log(`[pdfEngine] PDF buffer generated. Size: ${pdfBuffer.length} bytes`);

  // 4. Upload the generated PDF to Supabase Storage
  const supabase = createAdminClient();
  const filePath = `${orgId}/${quoteId}.pdf`;
  console.log(`[pdfEngine] Uploading PDF to storage bucket 'quotes' at path: ${filePath}`);

  const { error: uploadError } = await supabase.storage
    .from('quotes')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    console.error(`[pdfEngine] Failed to upload PDF to storage bucket:`, uploadError);
    throw new Error(`Storage upload error: ${uploadError.message}`);
  }

  console.log(`[pdfEngine] PDF uploaded successfully. Creating signed URL...`);

  // 5. Generate a signed URL for the quote PDF valid for 1 hour (3600 seconds)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('quotes')
    .createSignedUrl(filePath, 3600);

  if (signedError || !signedData?.signedUrl) {
    console.error(`[pdfEngine] Failed to create signed URL for PDF:`, signedError);
    throw new Error(`Signed URL generation error: ${signedError?.message || 'Unknown error'}`);
  }

  console.log(`[pdfEngine] PDF orchestration completed. Signed URL generated.`);
  return { pdfBuffer, signedUrl: signedData.signedUrl };
}
