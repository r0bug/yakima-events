/**
 * Shop Claim API
 * GET - Get claim status for current user
 * POST - Submit a new claim
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  submitClaimRequest,
  getClaimStatus,
  isShopClaimed,
} from '$lib/server/services/shopClaim';

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
    const {
      businessName,
      requesterName,
      requesterEmail,
      requesterPhone,
      relationshipToBusiness,
      ownershipProof,
    } = body;

    // Validation
    if (!businessName || !requesterName || !requesterEmail || !relationshipToBusiness) {
      return json({
        error: 'Business name, your name, email, and relationship to business are required'
      }, { status: 400 });
    }

    const claim = await submitClaimRequest(shopId, {
      businessName,
      requesterName,
      requesterEmail,
      requesterPhone,
      relationshipToBusiness,
      ownershipProof,
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
