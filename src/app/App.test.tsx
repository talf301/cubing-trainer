import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

// Mock gan-web-bluetooth to avoid CJS/ESM issues in test environment
vi.mock("gan-web-bluetooth", () => ({}));

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
