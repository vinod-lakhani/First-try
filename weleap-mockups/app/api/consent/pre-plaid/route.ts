/**
 * Consent API - Pre-Plaid
 * 
 * Records pre-Plaid consent to Terms of Service and Privacy Policy
 * before connecting financial accounts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TOS_VERSION, PRIVACY_POLICY_VERSION } from '@/lib/legal/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tosVersion, ppVersion } = body;

    // Validate input
    if (!userId || !tosVersion || !ppVersion) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, tosVersion, ppVersion' },
        { status: 400 }
      );
    }

    // Get IP address from request
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // In a real implementation, this would insert into a database:
    // INSERT INTO user_consents (user_id, consent_type, tos_version, pp_version, ip_address)
    // VALUES (userId, 'pre_plaid', tosVersion, ppVersion, ipAddress);
    
    // For now, we'll return success and log the consent
    console.log('[Consent API] Pre-Plaid consent recorded:', {
      userId,
      consentType: 'pre_plaid',
      tosVersion,
      ppVersion,
      ipAddress,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      consent: {
        userId,
        consentType: 'pre_plaid',
        tosVersion,
        ppVersion,
        createdAt: new Date().toISOString(),
        ipAddress,
      },
    });
  } catch (error) {
    console.error('[Consent API] Error recording pre-Plaid consent:', error);
    return NextResponse.json(
      { error: 'Failed to record consent' },
      { status: 500 }
    );
  }
}

