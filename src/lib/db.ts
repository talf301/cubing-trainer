// src/lib/db.ts
import { openDB, type IDBPDatabase } from "idb";

export interface AcubemyDB {
  solves: {
    key: string;
    value: {
      id: string;
      scramble: string;
      moves: { move: string; timestamp: number }[];
      startTime: number;
      endTime: number;
      duration: number;
      createdAt: number;
    };
    indexes: { "by-created": number };
  };
}

let dbPromise: Promise<IDBPDatabase<AcubemyDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<AcubemyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AcubemyDB>("acubemy", 1, {
      upgrade(db) {
        const solveStore = db.createObjectStore("solves", { keyPath: "id" });
        solveStore.createIndex("by-created", "createdAt");
      },
    });
  }
  return dbPromise;
}

/** Reset the cached DB promise — used in tests with fake-indexeddb */
export function resetDB(): void {
  dbPromise = null;
}
