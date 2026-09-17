import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateCredentialsSchema = z.object({
  email: z.string().email('Please enter a valid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters long').optional(),
  currentPassword: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = updateCredentialsSchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: issues }, { status: 400 });
    }

    const { email: newEmail, password: newPassword, currentPassword } = parseResult.data;

    if (!newEmail && !newPassword) {
      return NextResponse.json({ error: 'Provide at least an email or a password to update' }, { status: 400 });
    }

    const currentEmail = user.email ?? '';
    const isKeyAccount = currentEmail.endsWith('@enermass.local') || !currentEmail;
    const adminSupabase = createAdminClient();

    // If regular email user wants to change password, verify current password first
    if (!isKeyAccount && newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to set a new password' }, { status: 400 });
      }

      // Verify current password
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      const verifyClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error: signInErr } = await verifyClient.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });

      if (signInErr) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
    }

    // Build updates for Supabase Admin Auth
    const authUpdates: {
      email?: string;
      password?: string;
      email_confirm?: boolean;
      user_metadata?: Record<string, unknown>;
    } = {
      email_confirm: true,
    };

    if (newEmail) {
      authUpdates.email = newEmail.trim().toLowerCase();
      authUpdates.user_metadata = {
        ...(user.user_metadata || {}),
        email: newEmail.trim().toLowerCase(),
        email_verified: true,
      };
    }

    if (newPassword) {
      authUpdates.password = newPassword.trim();
    }

    // Update auth user
    const { data: updatedUserData, error: updateAuthError } = await adminSupabase.auth.admin.updateUserById(
      user.id,
      authUpdates
    );

    if (updateAuthError || !updatedUserData.user) {
      console.error('[API /api/profile/credentials] Failed to update auth user:', updateAuthError);
      return NextResponse.json(
        { error: updateAuthError?.message || 'Failed to update credentials' },
        { status: 500 }
      );
    }

    // Update public.profiles
    const profileUpdates: {
      email?: string;
      updated_at?: string;
    } = {
      updated_at: new Date().toISOString(),
    };
    if (newEmail) {
      profileUpdates.email = newEmail.trim().toLowerCase();
    }

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user.id);

    if (profileError) {
      console.error('[API /api/profile/credentials] Profile update warning:', profileError);
    }

    // If organization has dummy/test email, sync it with owner's email
    if (newEmail && user.user_metadata?.org_id) {
      const orgId = user.user_metadata.org_id;
      const { data: org } = await adminSupabase
        .from('organisations')
        .select('email')
        .eq('id', orgId)
        .maybeSingle();

      if (org && (!org.email || org.email.endsWith('@enermass.local') || org.email === 'test@gmail.com')) {
        await adminSupabase
          .from('organisations')
          .update({ email: newEmail.trim().toLowerCase(), updated_at: new Date().toISOString() })
          .eq('id', orgId);
      }
    }

    return NextResponse.json({
      success: true,
      email: newEmail ? newEmail.trim().toLowerCase() : currentEmail,
      message: isKeyAccount
        ? 'Email and password linked successfully! You can now log in directly using your email and password.'
        : 'Credentials updated successfully!',
    });
  } catch (error) {
    console.error('[API /api/profile/credentials] Unhandled error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
