/**
 * Shop Staff Service
 * Handles shop team management, invitations, and permissions
 */

import { db } from '$lib/server/db';
import { shopStaff, shopStaffInvites, localShops, users } from '$lib/server/db/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { ShopStaff, NewShopStaff, ShopStaffInvite, NewShopStaffInvite } from '$lib/server/db/schema';

const INVITE_EXPIRY_DAYS = 7;

export interface StaffPermissions {
  canEditShop: boolean;
  canCreateEvents: boolean;
  canPostDiscussions: boolean;
  canManageStaff: boolean;
}

export interface StaffMember {
  id: number;
  shopId: number;
  userId: number;
  role: 'admin' | 'staff';
  permissions: StaffPermissions;
  user: {
    id: number;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface PendingInvite {
  id: number;
  shopId: number;
  email: string;
  role: 'admin' | 'staff';
  permissions: StaffPermissions;
  invitedBy: {
    id: number;
    username: string;
    email: string;
  };
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Generate a secure invite token
 */
function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Check if user is a staff member of a shop
 */
export async function isUserShopStaff(shopId: number, userId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Check if user is an admin of a shop
 */
export async function isUserShopAdmin(shopId: number, userId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        eq(shopStaff.role, 'admin'),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Check if user can manage staff for a shop
 */
export async function canUserManageStaff(shopId: number, userId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        eq(shopStaff.canManageStaff, true),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Check if user can edit shop
 */
export async function canUserEditShop(shopId: number, userId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        eq(shopStaff.canEditShop, true),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Check if user can create events for shop
 */
export async function canUserCreateEvents(shopId: number, userId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        eq(shopStaff.canCreateEvents, true),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Get all staff members for a shop
 */
export async function getShopStaff(shopId: number): Promise<StaffMember[]> {
  const results = await db
    .select({
      staff: shopStaff,
      user: users,
    })
    .from(shopStaff)
    .innerJoin(users, eq(shopStaff.userId, users.id))
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        isNull(shopStaff.revokedAt)
      )
    );

  return results.map(({ staff, user }) => ({
    id: staff.id,
    shopId: staff.shopId,
    userId: staff.userId,
    role: staff.role,
    permissions: {
      canEditShop: staff.canEditShop ?? true,
      canCreateEvents: staff.canCreateEvents ?? true,
      canPostDiscussions: staff.canPostDiscussions ?? true,
      canManageStaff: staff.canManageStaff ?? false,
    },
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    },
    acceptedAt: staff.acceptedAt,
    createdAt: staff.createdAt!,
  }));
}

/**
 * Get pending invites for a shop
 */
export async function getPendingInvites(shopId: number): Promise<PendingInvite[]> {
  const now = new Date();

  const results = await db
    .select({
      invite: shopStaffInvites,
      inviter: users,
    })
    .from(shopStaffInvites)
    .innerJoin(users, eq(shopStaffInvites.invitedByUserId, users.id))
    .where(
      and(
        eq(shopStaffInvites.shopId, shopId),
        eq(shopStaffInvites.status, 'pending'),
        gt(shopStaffInvites.expiresAt, now)
      )
    );

  return results.map(({ invite, inviter }) => ({
    id: invite.id,
    shopId: invite.shopId,
    email: invite.email,
    role: invite.role,
    permissions: {
      canEditShop: invite.canEditShop ?? true,
      canCreateEvents: invite.canCreateEvents ?? true,
      canPostDiscussions: invite.canPostDiscussions ?? true,
      canManageStaff: invite.canManageStaff ?? false,
    },
    invitedBy: {
      id: inviter.id,
      username: inviter.username,
      email: inviter.email,
    },
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt!,
  }));
}

/**
 * Invite a new staff member
 */
export async function inviteStaffMember(
  shopId: number,
  email: string,
  role: 'admin' | 'staff',
  permissions: StaffPermissions,
  invitedByUserId: number,
  message?: string
): Promise<{ invite: ShopStaffInvite; token: string }> {
  // Check if already a staff member
  const existingStaff = await db
    .select()
    .from(shopStaff)
    .innerJoin(users, eq(shopStaff.userId, users.id))
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(users.email, email),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  if (existingStaff.length > 0) {
    throw new Error('User is already a staff member');
  }

  // Check for pending invite
  const existingInvite = await db
    .select()
    .from(shopStaffInvites)
    .where(
      and(
        eq(shopStaffInvites.shopId, shopId),
        eq(shopStaffInvites.email, email),
        eq(shopStaffInvites.status, 'pending')
      )
    )
    .limit(1);

  if (existingInvite.length > 0) {
    throw new Error('An invite is already pending for this email');
  }

  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  const result = await db.insert(shopStaffInvites).values({
    shopId,
    email,
    role,
    canEditShop: permissions.canEditShop,
    canCreateEvents: permissions.canCreateEvents,
    canPostDiscussions: permissions.canPostDiscussions,
    canManageStaff: permissions.canManageStaff,
    inviteToken: token,
    invitedByUserId,
    message,
    expiresAt,
    status: 'pending',
  });

  const invite = await db
    .select()
    .from(shopStaffInvites)
    .where(eq(shopStaffInvites.id, result[0].insertId))
    .limit(1);

  return { invite: invite[0], token };
}

/**
 * Accept an invitation by token
 */
export async function acceptInvite(token: string, userId: number): Promise<ShopStaff> {
  const now = new Date();

  // Find the invite
  const inviteResult = await db
    .select()
    .from(shopStaffInvites)
    .where(eq(shopStaffInvites.inviteToken, token))
    .limit(1);

  if (inviteResult.length === 0) {
    throw new Error('Invalid invite token');
  }

  const invite = inviteResult[0];

  if (invite.status !== 'pending') {
    throw new Error('This invite has already been used or cancelled');
  }

  if (invite.expiresAt < now) {
    throw new Error('This invite has expired');
  }

  // Check if user is already staff
  const existingStaff = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, invite.shopId),
        eq(shopStaff.userId, userId),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  if (existingStaff.length > 0) {
    throw new Error('You are already a staff member of this shop');
  }

  // Create staff record
  const staffResult = await db.insert(shopStaff).values({
    shopId: invite.shopId,
    userId,
    role: invite.role,
    canEditShop: invite.canEditShop,
    canCreateEvents: invite.canCreateEvents,
    canPostDiscussions: invite.canPostDiscussions,
    canManageStaff: invite.canManageStaff,
    invitedByUserId: invite.invitedByUserId,
    inviteEmail: invite.email,
    acceptedAt: now,
  });

  // Mark invite as accepted
  await db
    .update(shopStaffInvites)
    .set({
      status: 'accepted',
      acceptedAt: now,
      acceptedByUserId: userId,
    })
    .where(eq(shopStaffInvites.id, invite.id));

  const staff = await db
    .select()
    .from(shopStaff)
    .where(eq(shopStaff.id, staffResult[0].insertId))
    .limit(1);

  return staff[0];
}

/**
 * Cancel a pending invite
 */
export async function cancelInvite(inviteId: number, shopId: number): Promise<void> {
  await db
    .update(shopStaffInvites)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(shopStaffInvites.id, inviteId),
        eq(shopStaffInvites.shopId, shopId),
        eq(shopStaffInvites.status, 'pending')
      )
    );
}

/**
 * Remove a staff member
 */
export async function removeStaffMember(
  shopId: number,
  userId: number,
  removedByUserId: number
): Promise<void> {
  // Cannot remove yourself
  if (userId === removedByUserId) {
    throw new Error('You cannot remove yourself');
  }

  // Check if this is the last admin
  const admins = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.role, 'admin'),
        isNull(shopStaff.revokedAt)
      )
    );

  const targetStaff = await db
    .select()
    .from(shopStaff)
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        isNull(shopStaff.revokedAt)
      )
    )
    .limit(1);

  if (targetStaff.length === 0) {
    throw new Error('Staff member not found');
  }

  if (targetStaff[0].role === 'admin' && admins.length <= 1) {
    throw new Error('Cannot remove the last admin');
  }

  await db
    .update(shopStaff)
    .set({
      revokedAt: new Date(),
      revokedByUserId: removedByUserId,
    })
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        isNull(shopStaff.revokedAt)
      )
    );
}

/**
 * Update staff member permissions
 */
export async function updateStaffPermissions(
  shopId: number,
  userId: number,
  role: 'admin' | 'staff',
  permissions: StaffPermissions
): Promise<void> {
  // Check if demoting the last admin
  if (role === 'staff') {
    const admins = await db
      .select()
      .from(shopStaff)
      .where(
        and(
          eq(shopStaff.shopId, shopId),
          eq(shopStaff.role, 'admin'),
          isNull(shopStaff.revokedAt)
        )
      );

    const targetStaff = await db
      .select()
      .from(shopStaff)
      .where(
        and(
          eq(shopStaff.shopId, shopId),
          eq(shopStaff.userId, userId),
          isNull(shopStaff.revokedAt)
        )
      )
      .limit(1);

    if (targetStaff.length > 0 && targetStaff[0].role === 'admin' && admins.length <= 1) {
      throw new Error('Cannot demote the last admin');
    }
  }

  await db
    .update(shopStaff)
    .set({
      role,
      canEditShop: permissions.canEditShop,
      canCreateEvents: permissions.canCreateEvents,
      canPostDiscussions: permissions.canPostDiscussions,
      canManageStaff: permissions.canManageStaff,
    })
    .where(
      and(
        eq(shopStaff.shopId, shopId),
        eq(shopStaff.userId, userId),
        isNull(shopStaff.revokedAt)
      )
    );
}

/**
 * Get all shops for a user (where they are staff)
 */
export async function getShopsForUser(userId: number): Promise<Array<{
  shop: { id: number; name: string; imageUrl: string | null };
  role: 'admin' | 'staff';
  permissions: StaffPermissions;
}>> {
  const results = await db
    .select({
      staff: shopStaff,
      shop: localShops,
    })
    .from(shopStaff)
    .innerJoin(localShops, eq(shopStaff.shopId, localShops.id))
    .where(
      and(
        eq(shopStaff.userId, userId),
        isNull(shopStaff.revokedAt)
      )
    );

  return results.map(({ staff, shop }) => ({
    shop: {
      id: shop.id,
      name: shop.name,
      imageUrl: shop.imageUrl,
    },
    role: staff.role,
    permissions: {
      canEditShop: staff.canEditShop ?? true,
      canCreateEvents: staff.canCreateEvents ?? true,
      canPostDiscussions: staff.canPostDiscussions ?? true,
      canManageStaff: staff.canManageStaff ?? false,
    },
  }));
}

/**
 * Get invite by token (for display on accept page)
 */
export async function getInviteByToken(token: string): Promise<{
  invite: ShopStaffInvite;
  shop: { id: number; name: string; imageUrl: string | null };
  invitedBy: { username: string; email: string };
} | null> {
  const results = await db
    .select({
      invite: shopStaffInvites,
      shop: localShops,
      inviter: users,
    })
    .from(shopStaffInvites)
    .innerJoin(localShops, eq(shopStaffInvites.shopId, localShops.id))
    .innerJoin(users, eq(shopStaffInvites.invitedByUserId, users.id))
    .where(eq(shopStaffInvites.inviteToken, token))
    .limit(1);

  if (results.length === 0) return null;

  const { invite, shop, inviter } = results[0];
  return {
    invite,
    shop: {
      id: shop.id,
      name: shop.name,
      imageUrl: shop.imageUrl,
    },
    invitedBy: {
      username: inviter.username,
      email: inviter.email,
    },
  };
}

/**
 * Cleanup expired invites
 */
export async function cleanupExpiredInvites(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(shopStaffInvites)
    .set({ status: 'expired' })
    .where(
      and(
        eq(shopStaffInvites.status, 'pending'),
        gt(now, shopStaffInvites.expiresAt)
      )
    );

  return result[0]?.affectedRows || 0;
}
