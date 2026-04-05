import { openDB, type IDBPDatabase } from "idb";

export interface PhasewiseDB {
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
  pllRecognitionAttempts: {
    key: string;
    value: {
      id: string;
      caseName: string;
      viewingCorner: number;
      auf: number;
      correct: boolean;
      answerGiven: string;
      distractors: string[];
      recognitionTime: number;
      timestamp: number;
    };
    indexes: { "by-case": string; "by-timestamp": number };
  };
  pllSpamAttempts: {
    key: string;
    value: {
      id: string;
      caseName: string;
      time: number;
      moveCount: number;
      timestamp: number;
    };
    indexes: { "by-case": string; "by-timestamp": number };
  };
  f2lSolutionAttempts: {
    key: string;
    value: {
      id: string;
      caseName: string;
      time: number;
      moveCount: number;
      timestamp: number;
    };
    indexes: { "by-case": string; "by-timestamp": number };
  };
  llPracticeAttempts: {
    key: string;
    value: {
      id: string;
      ollSegments: { caseName: string; recognitionTime: number; executionTime: number }[];
      pllSegments: { caseName: string; recognitionTime: number; executionTime: number }[];
      ollTime: number;
      pllTime: number;
      totalTime: number;
      timestamp: number;
    };
    indexes: { "by-timestamp": number };
  };
}

let dbPromise: Promise<IDBPDatabase<PhasewiseDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PhasewiseDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PhasewiseDB>("phasewise", 6, {
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
        if (oldVersion < 3) {
          const recognitionStore = db.createObjectStore(
            "pllRecognitionAttempts",
            { keyPath: "id" },
          );
          recognitionStore.createIndex("by-case", "caseName");
          recognitionStore.createIndex("by-timestamp", "timestamp");
        }
        if (oldVersion < 4) {
          const spamStore = db.createObjectStore("pllSpamAttempts", {
            keyPath: "id",
          });
          spamStore.createIndex("by-case", "caseName");
          spamStore.createIndex("by-timestamp", "timestamp");
        }
        if (oldVersion < 5) {
          const f2lStore = db.createObjectStore("f2lSolutionAttempts", {
            keyPath: "id",
          });
          f2lStore.createIndex("by-case", "caseName");
          f2lStore.createIndex("by-timestamp", "timestamp");
        }
        if (oldVersion < 6) {
          const llPracticeStore = db.createObjectStore("llPracticeAttempts", {
            keyPath: "id",
          });
          llPracticeStore.createIndex("by-timestamp", "timestamp");
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
