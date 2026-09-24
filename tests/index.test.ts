import { describe, expect, it } from "vitest";
import { greet } from "../src/index.js";

describe("greet", () => {
  it("includes the given name", () => {
    expect(greet("Magnus")).toBe("Hello, Magnus! Welcome to jev-agent-chess.");
  });
});
