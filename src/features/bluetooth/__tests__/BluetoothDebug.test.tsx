// src/features/bluetooth/__tests__/BluetoothDebug.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BluetoothDebug } from "../BluetoothDebug";
import type {
  CubeConnection,
  ConnectionStatus,
} from "@/core/cube-connection";

// Mock CubeViewer to avoid cubing.js TwistyPlayer in jsdom
vi.mock("../CubeViewer", () => ({
  CubeViewer: () => <div data-testid="cube-viewer-mock" />,
}));

function createMockConnection(
  overrides: Partial<CubeConnection> = {},
): CubeConnection {
  return {
    status: "disconnected" as ConnectionStatus,
    state: null,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    resetState: vi.fn(),
    addMoveListener: vi.fn(),
    removeMoveListener: vi.fn(),
    addStatusListener: vi.fn(),
    removeStatusListener: vi.fn(),
    ...overrides,
  };
}

describe("BluetoothDebug", () => {
  it("renders connect button when disconnected", () => {
    const conn = createMockConnection();
    render(<BluetoothDebug connection={conn} />);
    expect(
      screen.getByRole("button", { name: /connect/i }),
    ).toBeInTheDocument();
  });

  it("shows disconnected status", () => {
    const conn = createMockConnection();
    render(<BluetoothDebug connection={conn} />);
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });

  it("calls connect when connect button is clicked", async () => {
    const conn = createMockConnection();
    render(<BluetoothDebug connection={conn} />);
    await userEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(conn.connect).toHaveBeenCalled();
  });
});
