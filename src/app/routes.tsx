// src/app/routes.tsx
import { useState, useEffect } from "react";
import { BluetoothDebug } from "@/features/bluetooth/BluetoothDebug";
import { GanBluetoothConnection } from "@/features/bluetooth/gan-bluetooth-connection";
import { SolvePage } from "@/features/solve/SolvePage";
import { SolveStore, type StoredSolve } from "@/lib/solve-store";
import { SolveHistory as SolveHistoryList } from "@/features/solve/SolveHistory";
import { TrainingPage } from "@/features/training/TrainingPage";
import { CrossTrainer } from "@/features/training/CrossTrainer";
import { PllTrainer } from "@/features/pll-trainer/PllTrainer";

// Shared connection instance — Timer, Debug, and Training all use the same cube
const sharedConnection = new GanBluetoothConnection();
const solveStore = new SolveStore();

function Timer() {
  return <SolvePage connection={sharedConnection} />;
}

function History() {
  const [solves, setSolves] = useState<StoredSolve[]>([]);

  useEffect(() => {
    solveStore.getAll().then(setSolves);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Solve History</h1>
      <SolveHistoryList solves={solves} />
    </div>
  );
}

function Training() {
  return <TrainingPage />;
}

function TrainingCross() {
  return <CrossTrainer connection={sharedConnection} />;
}

function PllTrainerRoute() {
  return <PllTrainer connection={sharedConnection} />;
}

function Settings() {
  return <h1 className="text-2xl font-bold">Settings</h1>;
}

function Debug() {
  return <BluetoothDebug connection={sharedConnection} />;
}

export { Timer, History, Training, TrainingCross, PllTrainerRoute, Settings, Debug };
