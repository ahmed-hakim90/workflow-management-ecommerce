/**
 * When enabled, API services use in-memory mock data (no Firestore).
 * Set DEV_MOCK_DATA=true in .env.local for local UI/demo work.
 */
export function isDevMockDataEnabled(): boolean {
  const v = process.env.DEV_MOCK_DATA?.toLowerCase().trim();
  return v === "true" || v === "1" || v === "yes";
}
