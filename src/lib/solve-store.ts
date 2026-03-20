import { getDB } from "./db";
import type { TimestampedMove } from "@/core/solve-session";
import type { CfopSplits } from "@/core/cfop-segmenter";
import { segmentSolve } from "@/core/cfop-segmenter";

export interface StoredSolve {
  id: string;
  scramble: string;
  moves: TimestampedMove[];
  startTime: number;
  endTime: number;
  duration: number;
  createdAt: number;
  splits?: CfopSplits;
}

export class SolveStore {
  async save(solve: StoredSolve): Promise<void> {
    const db = await getDB();
    await db.put("solves", solve);
  }

  async getAll(): Promise<StoredSolve[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex("solves", "by-created");
    return all.reverse(); // newest first
  }

  async getById(id: string): Promise<StoredSolve | undefined> {
    const db = await getDB();
    return db.get("solves", id);
  }

  async backfillSplits(): Promise<void> {
    const all = await this.getAll();
    for (const solve of all) {
      if (!solve.splits) {
        const splits = await segmentSolve(solve.scramble, solve.moves);
        solve.splits = splits;
        await this.save(solve);
      }
    }
  }
}
