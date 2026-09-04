import { describe, expect, it } from "vitest";
import { createSingleFlight } from "./singleFlight";

describe("single flight", () => {
  it("shares one in-flight operation across repeated calls", async () => {
    let calls = 0;
    const runOnce = createSingleFlight(async () => {
      calls += 1;
      return "done";
    });

    const [first, second] = await Promise.all([runOnce(), runOnce()]);

    expect(first).toBe("done");
    expect(second).toBe("done");
    expect(calls).toBe(1);
  });

  it("allows a new operation after the previous one settles", async () => {
    let calls = 0;
    const runOnce = createSingleFlight(async () => {
      calls += 1;
      return calls;
    });

    expect(await runOnce()).toBe(1);
    expect(await runOnce()).toBe(2);
  });
});
