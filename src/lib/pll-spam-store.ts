import { getDB } from "./db";

export interface PllSpamAttempt {
  id: string;
  caseName: string;
  time: number;
  moveCount: number;
  timestamp: number;
}

export class PllSpamStore {
  async addAttempt(attempt: PllSpamAttempt): Promise<void> {
    const db = await getDB();
    await db.put("pllSpamAttempts", attempt);
  }

  async getAttemptsByCase(caseName: string): Promise<PllSpamAttempt[]> {
    const db = await getDB();
    return db.getAllFromIndex("pllSpamAttempts", "by-case", caseName);
  }

  async getAllAttempts(): Promise<PllSpamAttempt[]> {
    const db = await getDB();
    return db.getAll("pllSpamAttempts");
  }
}
