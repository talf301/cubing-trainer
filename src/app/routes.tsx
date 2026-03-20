import { useState } from "react";
import { BluetoothDebug } from "@/features/bluetooth/BluetoothDebug";
import { GanBluetoothConnection } from "@/features/bluetooth/gan-bluetooth-connection";

function Timer() {
  return <h1 className="text-2xl font-bold">Timer</h1>;
}

function History() {
  return <h1 className="text-2xl font-bold">History</h1>;
}

function Training() {
  return <h1 className="text-2xl font-bold">Training</h1>;
}

function Settings() {
  return <h1 className="text-2xl font-bold">Settings</h1>;
}

function Debug() {
  const [connection] = useState(() => new GanBluetoothConnection());
  return <BluetoothDebug connection={connection} />;
}

export { Timer, History, Training, Settings, Debug };
