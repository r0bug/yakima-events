/**
 * Shop Claim Service
 * Handles shop ownership claims and verification
 */

import { db } from '$lib/server/db';
import { shopClaimRequests, shopStaff, localShops, users } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { ShopClaimRequest } from '$lib/server/db/schema';

export interface ClaimRequest {
  id: number;
  shopId: number | null;
  businessName: string;
  businessAddress: string | null;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  relationshipToBusiness: string | null;
  ownershipProof: string | null;
  status: 'pending' | 'approved' | 'rejected' | null;
  adminNotes: string | null;
  createdAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  shop?: {
    id: number;
    name: string;
    address: string;
  };
}

/**
 * Submit a claim request for a shop
 */
export async function submitClaimRequest(
  shopId: number,
  data: {
    businessName: string;
    requesterName: string;
    requesterEmail: string;
    requesterPhone?: string;
    relationshipToBusiness: string;
    ownershipProof?: string;
  },
  meta?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<ShopClaimRequest> {
  // Check if shop exists
  const shop = await db
    .select()
    .from(localShops)
    .where(eq(localShops.id, shopId))
    .limit(1);

  if (shop.length === 0) {
    throw new Error('Shop not found');
  }

  // Check for pending claim by the same email
  const existingClaim = await db
    .select()
    .from(shopClaimRequests)
    .where(
      and(
        eq(shopClaimRequests.shopId, shopId),
        eq(shopClaimRequests.requesterEmail, data.requesterEmail),
        eq(shopClaimRequests.status, 'pending')
      )
    )
    .limit(1);

  if (existingClaim.length > 0) {
    throw new Error('You already have a pending claim for this shop');
  }

  // Create claim request
  const result = await db.insert(shopClaimRequests).values({
    shopId,
    businessName: data.businessName,
    businessAddress: shop[0].address,
    requesterName: data.requesterName,
    requesterEmail: data.requesterEmail,
    requesterPhone: data.requesterPhone || null,
    relationshipToBusiness: data.relationshipToBusiness,
    ownershipProof: data.ownershipProof || null,
    claimType: 'existing_shop',
    status: 'pending',
    ipAddress: meta?.ipAddress || null,
    userAgent: meta?.userAgent || null,
  });

  const claim = await db
    .select()
    .from(shopClaimRequests)
    .where(eq(shopClaimRequests.id, result[0].insertId))
    .limit(1);

  return claim[0];
}

/**
 * Get claim status for an email and shop
 */
export async function getClaimStatus(
  shopId: number,
  email: string
): Promise<ShopClaimRequest | null> {
  const result = await db
    .select()
    .from(shopClaimRequests)
    .where(
      and(
        eq(shopClaimRequests.shopId, shopId),
        eq(shopClaimRequests.requesterEmail, email)
      )
    )
    .orderBy(desc(shopClaimRequests.createdAt))
    .limit(1);

  return result[0] || null;
}

/**
 * Get all claims for an email
 */
export async function getUserClaims(email: string): Promise<ClaimRequest[]> {
  const results = await db
    .select({
      claim: shopClaimRequests,
      shop: localShops,
    })
    .from(shopClaimRequests)
    .leftJoin(localShops, eq(shopClaimRequests.shopId, localShops.id))
    .where(eq(shopClaimRequests.requesterEmail, email))
    .orderBy(desc(shopClaimRequests.createdAt));

  return results.map(({ claim, shop }) => ({
    id: claim.id,
    shopId: claim.shopId,
    businessName: claim.businessName,
    businessAddress: claim.businessAddress,
    requesterName: claim.requesterName,
    requesterEmail: claim.requesterEmail,
    requesterPhone: claim.requesterPhone,
    relationshipToBusiness: claim.relationshipToBusiness,
    ownershipProof: claim.ownershipProof,
    status: claim.status,
    adminNotes: claim.adminNotes,
    createdAt: claim.createdAt,
    reviewedAt: claim.reviewedAt,
    reviewedBy: claim.reviewedBy,
    shop: shop ? {
      id: shop.id,
      name: shop.name,
      address: shop.address || '',
    } : undefined,
  }));
}

/**
 * Get all pending claims (for admins)
 */
export async function getPendingClaims(): Promise<ClaimRequest[]> {
  const results = await db
    .select({
      claim: shopClaimRequests,
      shop: localShops,
    })
    .from(shopClaimRequests)
    .leftJoin(localShops, eq(shopClaimRequests.shopId, localShops.id))
    .where(eq(shopClaimRequests.status, 'pending'))
    .orderBy(desc(shopClaimRequests.createdAt));

  return results.map(({ claim, shop }) => ({
    id: claim.id,
    shopId: claim.shopId,
    businessName: claim.businessName,
    businessAddress: claim.businessAddress,
    requesterName: claim.requesterName,
    requesterEmail: claim.requesterEmail,
    requesterPhone: claim.requesterPhone,
    relationshipToBusiness: claim.relationshipToBusiness,
    ownershipProof: claim.ownershipProof,
    status: claim.status,
    adminNotes: claim.adminNotes,
    createdAt: claim.createdAt,
    reviewedAt: claim.reviewedAt,
    reviewedBy: claim.reviewedBy,
    shop: shop ? {
      id: shop.id,
      name: shop.name,
      address: shop.address || '',
    } : undefined,
  }));
}

/**
 * Get all claims (for admins)
 */
export async function getAllClaims(status?: string): Promise<ClaimRequest[]> {
  let query = db
    .select({
      claim: shopClaimRequests,
      shop: localShops,
    })
    .from(shopClaimRequests)
    .leftJoin(localShops, eq(shopClaimRequests.shopId, localShops.id));

  if (status) {
    query = query.where(eq(shopClaimRequests.status, status as 'pending' | 'approved' | 'rejected'));
  }

  const results = await query.orderBy(desc(shopClaimRequests.createdAt));

  return results.map(({ claim, shop }) => ({
    id: claim.id,
    shopId: claim.shopId,
    businessName: claim.businessName,
    businessAddress: claim.businessAddress,
    requesterName: claim.requesterName,
    requesterEmail: claim.requesterEmail,
    requesterPhone: claim.requesterPhone,
    relationshipToBusiness: claim.relationshipToBusiness,
    ownershipProof: claim.ownershipProof,
    status: claim.status,
    adminNotes: claim.adminNotes,
    createdAt: claim.createdAt,
    reviewedAt: claim.reviewedAt,
    reviewedBy: claim.reviewedBy,
    shop: shop ? {
      id: shop.id,
      name: shop.name,
      address: shop.address || '',
    } : undefined,
  }));
}

/**
 * Approve a claim request
 */
export async function approveClaim(
  claimId: number,
  adminUsername: string,
  notes?: string
): Promise<void> {
  // Get the claim
  const claim = await db
    .select()
    .from(shopClaimRequests)
    .where(eq(shopClaimRequests.id, claimId))
    .limit(1);

  if (claim.length === 0) {
    throw new Error('Claim not found');
  }

  if (claim[0].status !== 'pending') {
    throw new Error('Claim has already been processed');
  }

  // Update claim status
  await db
    .update(shopClaimRequests)
    .set({
      status: 'approved',
      adminNotes: notes || null,
      reviewedAt: new Date(),
      reviewedBy: adminUsername,
    })
    .where(eq(shopClaimRequests.id, claimId));

  // Try to find or create user by email and add as shop admin
  const shopId = claim[0].shopId;
  if (shopId) {
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, claim[0].requesterEmail))
      .limit(1);

    if (existingUser.length > 0) {
      // Add user as shop admin
      await db.insert(shopStaff).values({
        shopId,
        userId: existingUser[0].id,
        role: 'admin',
        canEditShop: true,
        canCreateEvents: true,
        canPostDiscussions: true,
        canManageStaff: true,
        acceptedAt: new Date(),
      });
    }
    // If no user exists, they'll be added when they sign up with the same email
  }
}

/**
 * Reject a claim request
 */
export async function rejectClaim(
  claimId: number,
  adminUsername: string,
  reason: string
): Promise<void> {
  const claim = await db
    .select()
    .from(shopClaimRequests)
    .where(eq(shopClaimRequests.id, claimId))
    .limit(1);

  if (claim.length === 0) {
    throw new Error('Claim not found');
  }

  if (claim[0].status !== 'pending') {
    throw new Error('Claim has already been processed');
  }

  await db
    .update(shopClaimRequests)
    .set({
      status: 'rejected',
      adminNotes: reason,
      reviewedAt: new Date(),
      reviewedBy: adminUsername,
    })
    .where(eq(shopClaimRequests.id, claimId));
}

/**
 * Check if a shop has been claimed
 */
export async function isShopClaimed(shopId: number): Promise<boolean> {
  const result = await db
    .select()
    .from(shopStaff)
    .where(eq(shopStaff.shopId, shopId))
    .limit(1);

  return result.length > 0;
}
