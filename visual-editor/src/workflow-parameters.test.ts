import { describe, expect, it } from "vitest";
import {
  createResourceReference,
  normaliseNodeData,
  normaliseParameterValue,
  normaliseParameters,
} from "./workflow-parameters";

describe("workflow-parameters", () => {
  it("normalises parameters with nested structures", () => {
    const parameters = normaliseParameters(
      new Map<string, unknown>([
        ["timestamp", new Date("2024-06-01T10:00:00.000Z")],
        ["endpoint", new URL("https://api.example.com/data")],
        ["flags", new Set([true, false])],
        [
          "extra",
          new Map<string, unknown>([
            ["retries", 3],
            ["regions", new Set(["eu", "us"])],
          ]),
        ],
      ]),
    );

    expect(parameters.timestamp).toBe("2024-06-01T10:00:00.000Z");
    expect(parameters.endpoint).toBe("https://api.example.com/data");
    expect(parameters.flags).toEqual([true, false]);
    expect(parameters.extra).toEqual({ retries: 3, regions: ["eu", "us"] });
  });

  it("creates resource references with metadata", () => {
    const resource = createResourceReference("s3://datasets/example.csv", {
      name: "Dataset di esempio",
      description: "File CSV normalizzato",
      metadata: { format: "csv" },
    });

    expect(resource).toEqual({
      type: "resource",
      uri: "s3://datasets/example.csv",
      name: "Dataset di esempio",
      description: "File CSV normalizzato",
      metadata: { format: "csv" },
    });
  });

  it("normalises node data payloads", () => {
    const data = normaliseNodeData({
      component: "datapizza.example.component",
      parameters: {
        list: [1, 2, 3],
        schedule: {
          start: new Date("2024-05-01T12:00:00.000Z"),
          url: new URL("https://datapizza.ai"),
        },
      },
    });

    expect(data).toEqual({
      component: "datapizza.example.component",
      parameters: {
        list: [1, 2, 3],
        schedule: {
          start: "2024-05-01T12:00:00.000Z",
          url: "https://datapizza.ai/",
        },
      },
    });
  });

  it("converts unsupported values to strings", () => {
    class CustomValue {
      constructor(public value: string) {}
      toString(): string {
        return this.value;
      }
    }

    const normalised = normaliseParameterValue(new CustomValue("custom"));
    expect(normalised).toBe("custom");
  });
});
