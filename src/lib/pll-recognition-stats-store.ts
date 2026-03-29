import { getDB } from "./db";

export interface PllRecognitionAttempt {
  id: string;
  caseName: string;
  viewingCorner: number;
  auf: number;
  correct: boolean;
  answerGiven: string;
  distractors: string[];
  recognitionTime: number;
  timestamp: number;
}

export interface PllRecognitionCaseStats {
  caseName: string;
  attemptCount: number;
  accuracy: number;
  avgTime: number;
  lastAttemptAt: number;
}

export class PllRecognitionStatsStore {
  async recordAttempt(attempt: PllRecognitionAttempt): Promise<void> {
    const db = await getDB();
    await db.put("pllRecognitionAttempts", attempt);
  }

  async getAttemptsForCase(
    caseName: string,
  ): Promise<PllRecognitionAttempt[]> {
    const db = await getDB();
    return db.getAllFromIndex("pllRecognitionAttempts", "by-case", caseName);
  }

  async getStatsForCase(
    caseName: string,
  ): Promise<PllRecognitionCaseStats | null> {
    const attempts = await this.getAttemptsForCase(caseName);
    if (attempts.length === 0) return null;
    return computeStats(caseName, attempts);
  }

  async getAllStats(): Promise<PllRecognitionCaseStats[]> {
    const db = await getDB();
    const allAttempts = await db.getAll("pllRecognitionAttempts");

    // Group attempts by case name
    const byCaseName = new Map<string, PllRecognitionAttempt[]>();
    for (const attempt of allAttempts) {
      const list = byCaseName.get(attempt.caseName);
      if (list) {
        list.push(attempt);
      } else {
        byCaseName.set(attempt.caseName, [attempt]);
      }
    }

    const stats: PllRecognitionCaseStats[] = [];
    for (const [caseName, attempts] of byCaseName) {
      stats.push(computeStats(caseName, attempts));
    }
    return stats;
  }
}

function computeStats(
  caseName: string,
  attempts: PllRecognitionAttempt[],
): PllRecognitionCaseStats {
  const correctCount = attempts.filter((a) => a.correct).length;
  const totalTime = attempts.reduce((sum, a) => sum + a.recognitionTime, 0);
  const lastAttemptAt = Math.max(...attempts.map((a) => a.timestamp));

  return {
    caseName,
    attemptCount: attempts.length,
    accuracy: correctCount / attempts.length,
    avgTime: totalTime / attempts.length,
    lastAttemptAt,
  };
}
