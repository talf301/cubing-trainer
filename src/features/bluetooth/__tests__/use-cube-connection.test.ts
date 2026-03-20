// src/features/bluetooth/__tests__/use-cube-connection.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCubeConnection } from "../use-cube-connection";
import type {
  CubeConnection,
  ConnectionStatus,
  CubeMoveEvent,
} from "@/core/cube-connection";

function createMockConnection(): CubeConnection & {
  simulateMove: (event: CubeMoveEvent) => void;
  simulateStatus: (status: ConnectionStatus) => void;
} {
  const moveListeners = new Set<(event: CubeMoveEvent) => void>();
  const statusListeners = new Set<(status: ConnectionStatus) => void>();

  return {
    status: "disconnected" as ConnectionStatus,
    state: null,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    resetState: vi.fn(),
    addMoveListener: (cb) => moveListeners.add(cb),
    removeMoveListener: (cb) => moveListeners.delete(cb),
    addStatusListener: (cb) => statusListeners.add(cb),
    removeStatusListener: (cb) => statusListeners.delete(cb),
    simulateMove: (event) => {
      for (const cb of moveListeners) cb(event);
    },
    simulateStatus: (status) => {
      for (const cb of statusListeners) cb(status);
    },
  };
}

describe("useCubeConnection", () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    mockConnection = createMockConnection();
  });

  it("starts with disconnected status and empty moves", () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));
    expect(result.current.status).toBe("disconnected");
    expect(result.current.moves).toEqual([]);
    expect(result.current.state).toBeNull();
  });

  it("calls connect on the connection", async () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));
    await act(async () => {
      await result.current.connect();
    });
    expect(mockConnection.connect).toHaveBeenCalled();
  });

  it("updates status when connection status changes", () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));
    act(() => {
      mockConnection.simulateStatus("connected");
    });
    expect(result.current.status).toBe("connected");
  });

  it("accumulates moves when move events fire", async () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));

    const fakeMoveEvent = {
      move: { toString: () => "R" },
      timestamp: 1000,
      state: {},
    } as unknown as CubeMoveEvent;

    act(() => {
      mockConnection.simulateMove(fakeMoveEvent);
    });

    expect(result.current.moves).toHaveLength(1);
    expect(result.current.moves[0]).toBe(fakeMoveEvent);
  });

  it("calls disconnect on the connection", () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));
    act(() => {
      result.current.disconnect();
    });
    expect(mockConnection.disconnect).toHaveBeenCalled();
  });

  it("calls resetState and clears moves", () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));

    const fakeMoveEvent = {
      move: { toString: () => "R" },
      timestamp: 1000,
      state: {},
    } as unknown as CubeMoveEvent;

    act(() => {
      mockConnection.simulateMove(fakeMoveEvent);
    });
    expect(result.current.moves).toHaveLength(1);

    act(() => {
      result.current.resetState();
    });
    expect(mockConnection.resetState).toHaveBeenCalled();
    expect(result.current.moves).toEqual([]);
  });

  it("cleans up listeners on unmount", () => {
    const { unmount } = renderHook(() => useCubeConnection(mockConnection));
    unmount();
    // Verify no errors on simulating events after unmount
    mockConnection.simulateStatus("connected");
    mockConnection.simulateMove({
      move: { toString: () => "R" },
      timestamp: 1000,
      state: {},
    } as unknown as CubeMoveEvent);
  });
});
