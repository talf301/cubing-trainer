// src/app/routes.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BluetoothDebug } from "@/features/bluetooth/BluetoothDebug";
import { GanBluetoothConnection } from "@/features/bluetooth/gan-bluetooth-connection";
import { SolvePage } from "@/features/solve/SolvePage";
import { SolveStore, type StoredSolve } from "@/lib/solve-store";
import { SolveHistory as SolveHistoryList } from "@/features/solve/SolveHistory";
import { PllTrainer } from "@/features/pll-trainer/PllTrainer";

// Shared connection instance — both Timer and Debug use the same cube
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
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Training</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/training/pll"
          className="rounded-lg border border-gray-700 bg-gray-900 p-6 hover:border-gray-500 transition"
        >
          <h2 className="text-lg font-semibold">PLL Trainer</h2>
          <p className="mt-2 text-sm text-gray-400">
            Drill and learn all 21 PLL algorithms with smart case selection and
            move-by-move feedback.
          </p>
        </Link>
      </div>
    </div>
  );
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

export { Timer, History, Training, PllTrainerRoute, Settings, Debug };
