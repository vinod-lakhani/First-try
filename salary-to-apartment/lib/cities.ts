/**
 * City to State Code Mapping
 * Maps city names to their 2-letter state codes for tax calculation
 */

export interface CityMapping {
  city: string;
  stateCode: string;
}

export const CITY_MAPPINGS: CityMapping[] = [
  { city: 'Austin', stateCode: 'TX' },
  { city: 'NYC', stateCode: 'NY' },
  { city: 'SF Bay Area', stateCode: 'CA' },
  { city: 'Seattle', stateCode: 'WA' },
  { city: 'Boston', stateCode: 'MA' },
  { city: 'Chicago', stateCode: 'IL' },
];

/**
 * Get state code for a given city
 * Returns undefined if city is not in the mapping
 */
export function getStateCodeForCity(city: string): string | undefined {
  const mapping = CITY_MAPPINGS.find(
    (m) => m.city.toLowerCase() === city.toLowerCase()
  );
  return mapping?.stateCode;
}

/**
 * Check if a city is in the predefined list
 */
export function isKnownCity(city: string): boolean {
  return CITY_MAPPINGS.some(
    (m) => m.city.toLowerCase() === city.toLowerCase()
  );
}

/**
 * Get all available cities
 */
export function getAvailableCities(): string[] {
  return CITY_MAPPINGS.map((m) => m.city);
}
