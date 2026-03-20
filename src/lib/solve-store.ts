import { getDB } from "./db";

export interface TimestampedMove {
  move: string;
  timestamp: number;
}

export interface StoredSolve {
  id: string;
  scramble: string;
  moves: TimestampedMove[];
  startTime: number;
  endTime: number;
  duration: number;
  createdAt: number;
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
}
