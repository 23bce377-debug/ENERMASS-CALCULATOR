import { describe, expect, it, vi, beforeEach } from 'vitest';
import { adminChangeUserRoleAction } from '@/app/super-admin/actions';

// Mock dependencies
const mockRequireSuperAdminSession = vi.fn().mockResolvedValue({ user: { id: '00000000-0000-0000-0000-000000000001' } });
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

const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { role: 'staff', org_id: '00000000-0000-0000-0000-000000000002' }, error: null });
const mockEqSelect = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect });

const mockAdminClient = {
  from: (table: string) => {
    const mockInsertChain = () => ({
      select: () => ({
        maybeSingle: () => Promise.resolve({ data: {}, error: null })
      })
    });
    if (table === 'profiles') {
      return { update: mockUpdateProfile, select: mockSelect, insert: mockInsertChain };
    }
    if (table === 'org_members') {
      return { update: mockUpdateMember, select: mockSelect, insert: mockInsertChain };
    }
    return {
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: {}, error: null }) }) }),
      insert: mockInsertChain,
    };
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
    formData.append('userId', '00000000-0000-0000-0000-000000000123');
    formData.append('role', 'admin');

    await adminChangeUserRoleAction(formData);

    // Assert profiles update
    expect(mockUpdateProfile).toHaveBeenCalledWith({ role: 'admin' });
    expect(mockEqProfile).toHaveBeenCalledWith('id', '00000000-0000-0000-0000-000000000123');

    // Assert org_members update
    expect(mockUpdateMember).toHaveBeenCalledWith({ role: 'admin' });
    expect(mockEqMember).toHaveBeenCalledWith('user_id', '00000000-0000-0000-0000-000000000123');

    // Assert Auth metadata update
    expect(mockUpdateUserById).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000123', {
      app_metadata: { role: 'admin' },
      user_metadata: { role: 'admin' },
    });
  });

  it('throws an error if not authorized as super admin', async () => {
    mockRequireSuperAdminSession.mockRejectedValueOnce(new Error('Unauthorized'));

    const formData = new FormData();
    formData.append('userId', '00000000-0000-0000-0000-000000000123');
    formData.append('role', 'admin');

    await expect(adminChangeUserRoleAction(formData)).rejects.toThrow('Unauthorized');
  });

  it('throws an error if parameters are missing', async () => {
    const formData = new FormData();
    // Missing userId and role

    await expect(adminChangeUserRoleAction(formData)).rejects.toThrow('User ID and Role are required.');
  });
});
