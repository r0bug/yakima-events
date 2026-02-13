/**
 * Shop Claim API
 * GET - Get claim status for current user
 * POST - Submit a new claim
 */

import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import {
  submitClaimRequest,
  getClaimStatus,
  isShopClaimed,
} from '$lib/server/services/shopClaim';

const claimSchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(200),
  requesterName: z.string().min(1, 'Your name is required').max(200),
  requesterEmail: z.string().email('Valid email is required'),
  requesterPhone: z.string().max(50).optional().default(''),
  relationshipToBusiness: z.enum(['owner', 'manager', 'employee', 'representative'], {
    errorMap: () => ({ message: 'Please select your relationship to the business' }),
  }),
  ownershipProof: z.string().max(2000).optional().default(''),
});

export const GET: RequestHandler = async ({ params, locals }) => {
  const shopId = parseInt(params.id);

  if (isNaN(shopId)) {
    return json({ error: 'Invalid shop ID' }, { status: 400 });
  }

  try {
    const claimed = await isShopClaimed(shopId);

    if (!locals.user) {
      return json({
        success: true,
        claimed,
        userClaim: null,
      });
    }

    const userClaim = await getClaimStatus(shopId, locals.user.email);

    return json({
      success: true,
      claimed,
      userClaim: userClaim ? {
        id: userClaim.id,
        status: userClaim.status,
        createdAt: userClaim.createdAt,
        reviewedAt: userClaim.reviewedAt,
        adminNotes: userClaim.status === 'rejected' ? userClaim.adminNotes : null,
      } : null,
    });
  } catch (error) {
    console.error('Error getting claim status:', error);
    return json({ error: 'Failed to get claim status' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
  const shopId = parseInt(params.id);

  if (isNaN(shopId)) {
    return json({ error: 'Invalid shop ID' }, { status: 400 });
  }

  if (!locals.user) {
    return json({ error: 'Unauthorized - please sign in' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = claimSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return json({ error: errors }, { status: 400 });
    }

    const data = parsed.data;
    const claim = await submitClaimRequest(shopId, {
      businessName: data.businessName,
      requesterName: data.requesterName,
      requesterEmail: data.requesterEmail,
      requesterPhone: data.requesterPhone,
      relationshipToBusiness: data.relationshipToBusiness,
      ownershipProof: data.ownershipProof,
    }, {
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return json({
      success: true,
      claim: {
        id: claim.id,
        status: claim.status,
        createdAt: claim.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error submitting claim:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit claim';
    return json({ error: message }, { status: 400 });
  }
};
