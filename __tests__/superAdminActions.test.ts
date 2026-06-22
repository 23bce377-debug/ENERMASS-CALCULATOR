import { describe, expect, it, vi, beforeEach } from 'vitest';
import { adminChangeUserRoleAction } from '@/app/super-admin/actions';

// Mock dependencies
const mockRequireSuperAdminSession = vi.fn().mockResolvedValue({ user: { id: 'admin-1' } });
vi.mock('@/lib/saas/services/managementService', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    requireSuperAdminSession: (...args: any[]) => mockRequireSuperAdminSession(...args),
  };
});

const mockEqProfile = vi.fn().mockResolvedValue({ error: null });
const mockUpdateProfile = vi.fn().mockReturnValue({ eq: mockEqProfile });

const mockEqMember = vi.fn().mockResolvedValue({ error: null });
const mockUpdateMember = vi.fn().mockReturnValue({ eq: mockEqMember });

const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null });

const mockAdminClient = {
  from: (table: string) => {
    if (table === 'profiles') {
      return { update: mockUpdateProfile };
    }
    if (table === 'org_members') {
      return { update: mockUpdateMember };
    }
    return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
  },
  auth: {
    admin: {
      updateUserById: mockUpdateUserById,
    },
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mockAdminClient,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('adminChangeUserRoleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates profile, org members, and auth app_metadata', async () => {
    const formData = new FormData();
    formData.append('userId', 'user-123');
    formData.append('role', 'admin');

    await adminChangeUserRoleAction(formData);

    // Assert profiles update
    expect(mockUpdateProfile).toHaveBeenCalledWith({ role: 'admin' });
    expect(mockEqProfile).toHaveBeenCalledWith('id', 'user-123');

    // Assert org_members update
    expect(mockUpdateMember).toHaveBeenCalledWith({ role: 'admin' });
    expect(mockEqMember).toHaveBeenCalledWith('user_id', 'user-123');

    // Assert Auth metadata update
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-123', {
      app_metadata: { role: 'admin' },
    });
  });

  it('throws an error if not authorized as super admin', async () => {
    mockRequireSuperAdminSession.mockRejectedValueOnce(new Error('Unauthorized'));

    const formData = new FormData();
    formData.append('userId', 'user-123');
    formData.append('role', 'admin');

    await expect(adminChangeUserRoleAction(formData)).rejects.toThrow('Unauthorized');
  });

  it('throws an error if parameters are missing', async () => {
    const formData = new FormData();
    // Missing userId and role

    await expect(adminChangeUserRoleAction(formData)).rejects.toThrow('User ID and Role are required.');
  });
});
