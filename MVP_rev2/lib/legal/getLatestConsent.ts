/**
 * Get Latest Consent
 * 
 * Helper functions for managing user consents.
 */

export interface UserConsent {
  id: string;
  userId: string;
  consentType: "signup" | "pre_plaid" | "update";
  tosVersion: string;
  ppVersion: string;
  createdAt: string;
  ipAddress?: string;
}

/**
 * Get the latest consent for a user by type
 * 
 * Note: In a real implementation, this would query a database.
 * For now, we'll use localStorage to simulate consent storage.
 */
export function getLatestConsent(
  userId: string,
  consentType: "signup" | "pre_plaid" | "update"
): UserConsent | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const key = `weleap_consent_${userId}_${consentType}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error getting latest consent:', error);
    return null;
  }
}

/**
 * Get all consents for a user
 */
export function getAllUserConsents(userId: string): UserConsent[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const consents: UserConsent[] = [];
    const types: Array<"signup" | "pre_plaid" | "update"> = ["signup", "pre_plaid", "update"];
    
    types.forEach(type => {
      const consent = getLatestConsent(userId, type);
      if (consent) {
        consents.push(consent);
      }
    });
    
    return consents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Error getting all user consents:', error);
    return [];
  }
}

/**
 * Get the most recent consent (any type)
 */
export function getMostRecentConsent(userId: string): UserConsent | null {
  const allConsents = getAllUserConsents(userId);
  return allConsents.length > 0 ? allConsents[0] : null;
}

