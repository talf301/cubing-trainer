import { getDB } from "./db";

export interface F2LSolutionAttempt {
  id: string;
  caseName: string;
  time: number;
  moveCount: number;
  timestamp: number;
}

export class F2LSolutionStore {
  async addAttempt(attempt: F2LSolutionAttempt): Promise<void> {
    const db = await getDB();
    await db.put("f2lSolutionAttempts", attempt);
  }

  async getAttemptsByCase(caseName: string): Promise<F2LSolutionAttempt[]> {
    const db = await getDB();
    return db.getAllFromIndex("f2lSolutionAttempts", "by-case", caseName);
  }

  async getAllAttempts(): Promise<F2LSolutionAttempt[]> {
    const db = await getDB();
    return db.getAll("f2lSolutionAttempts");
  }
}
