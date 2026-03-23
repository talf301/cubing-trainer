import { getDB } from "./db";

export interface PllKnownCase {
  name: string;
  addedAt: number;
}

export interface PllAttempt {
  id: string;
  caseName: string;
  time: number;
  moveCount: number;
  was2Look: boolean;
  timestamp: number;
}

export interface PllCaseStats {
  caseName: string;
  attemptCount: number;
  avgTime: number;
  bestTime: number;
  twoLookRate: number;
}

export class PllStatsStore {
  async getKnownCases(): Promise<PllKnownCase[]> {
    const db = await getDB();
    return db.getAll("pllKnownCases");
  }

  async addKnownCase(name: string): Promise<void> {
    const db = await getDB();
    await db.put("pllKnownCases", { name, addedAt: Date.now() });
  }

  async removeKnownCase(name: string): Promise<void> {
    const db = await getDB();
    await db.delete("pllKnownCases", name);
  }

  async recordAttempt(attempt: PllAttempt): Promise<void> {
    const db = await getDB();
    await db.put("pllAttempts", attempt);
  }

  async getAttemptsForCase(caseName: string): Promise<PllAttempt[]> {
    const db = await getDB();
    return db.getAllFromIndex("pllAttempts", "by-case", caseName);
  }

  async getStatsForCase(caseName: string): Promise<PllCaseStats | null> {
    const attempts = await this.getAttemptsForCase(caseName);
    if (attempts.length === 0) return null;
    return computeStats(caseName, attempts);
  }

  async getAllStats(): Promise<PllCaseStats[]> {
    const knownCases = await this.getKnownCases();
    const stats: PllCaseStats[] = [];
    for (const kc of knownCases) {
      const caseStats = await this.getStatsForCase(kc.name);
      if (caseStats) {
        stats.push(caseStats);
      } else {
        // Known case with no attempts yet — return zeroed stats
        stats.push({
          caseName: kc.name,
          attemptCount: 0,
          avgTime: 0,
          bestTime: 0,
          twoLookRate: 0,
        });
      }
    }
    return stats;
  }
}

function computeStats(caseName: string, attempts: PllAttempt[]): PllCaseStats {
  const totalTime = attempts.reduce((sum, a) => sum + a.time, 0);
  const bestTime = Math.min(...attempts.map((a) => a.time));
  const twoLookCount = attempts.filter((a) => a.was2Look).length;

  return {
    caseName,
    attemptCount: attempts.length,
    avgTime: totalTime / attempts.length,
    bestTime,
    twoLookRate: twoLookCount / attempts.length,
  };
}
