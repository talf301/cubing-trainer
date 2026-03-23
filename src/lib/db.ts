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
      splits?: {
        crossTime?: number;
        f2lTime?: number;
        ollTime?: number;
        crossFace?: string;
        ollCase?: string;
        pllCase?: string;
      };
    };
    indexes: { "by-created": number };
  };
  pllKnownCases: {
    key: string;
    value: {
      name: string;
      addedAt: number;
    };
  };
  pllAttempts: {
    key: string;
    value: {
      id: string;
      caseName: string;
      time: number;
      moveCount: number;
      was2Look: boolean;
      timestamp: number;
    };
    indexes: { "by-case": string; "by-timestamp": number };
  };
}

let dbPromise: Promise<IDBPDatabase<AcubemyDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<AcubemyDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AcubemyDB>("acubemy", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const solveStore = db.createObjectStore("solves", { keyPath: "id" });
          solveStore.createIndex("by-created", "createdAt");
        }
        if (oldVersion < 2) {
          db.createObjectStore("pllKnownCases", { keyPath: "name" });
          const attemptStore = db.createObjectStore("pllAttempts", {
            keyPath: "id",
          });
          attemptStore.createIndex("by-case", "caseName");
          attemptStore.createIndex("by-timestamp", "timestamp");
        }
      },
    });
  }
  return dbPromise;
}

/** Reset the cached DB promise — used in tests with fake-indexeddb */
export function resetDB(): void {
  dbPromise = null;
}
