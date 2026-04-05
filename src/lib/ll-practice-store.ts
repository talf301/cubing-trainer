import { getDB } from "./db";
import type { LLPhaseSegment } from "../core/ll-practice-session";

export interface LLPracticeAttempt {
  id: string;
  ollSegments: LLPhaseSegment[];
  pllSegments: LLPhaseSegment[];
  ollTime: number;
  pllTime: number;
  totalTime: number;
  timestamp: number;
}

export class LLPracticeStore {
  async addAttempt(attempt: LLPracticeAttempt): Promise<void> {
    const db = await getDB();
    await db.put("llPracticeAttempts", attempt);
  }

  async getAllAttempts(): Promise<LLPracticeAttempt[]> {
    const db = await getDB();
    return db.getAll("llPracticeAttempts");
  }
}
