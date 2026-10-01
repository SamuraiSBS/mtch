export interface FspProvider { getVerifiedAchievements(specialistUserId: string): Promise<never[]> }
export const unavailableFspProvider: FspProvider = { async getVerifiedAchievements() { return []; } };
