import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Layout from "./Layout";

// Mock gan-web-bluetooth to avoid CJS/ESM issues in test environment
vi.mock("gan-web-bluetooth", () => ({}));

describe("App", () => {
  it("renders without crashing", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
