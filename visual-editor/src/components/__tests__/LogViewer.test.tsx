import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { LogViewer } from "../LogViewer";
import type { WorkflowRunLogEntry } from "../../services/workflow-api";

const baseLogs: WorkflowRunLogEntry[] = [
  {
    id: "1",
    sequence: 1,
    timestamp: "2024-01-01T10:00:00.000Z",
    message: "Pipeline avviata",
    level: "info",
    source: "scheduler",
  },
  {
    id: "2",
    sequence: 2,
    timestamp: "2024-01-01T10:01:00.000Z",
    message: "Dato non valido",
    level: "warning",
    nodeId: "validator",
  },
  {
    id: "3",
    sequence: 3,
    timestamp: "2024-01-01T10:02:00.000Z",
    message: "Worker in errore",
    level: "error",
    source: "worker-1",
  },
];

describe("LogViewer", () => {
  it("permette di filtrare i log per livello", async () => {
    const user = userEvent.setup();
    render(<LogViewer logs={baseLogs} />);

    expect(screen.queryAllByText("Pipeline avviata").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Dato non valido").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Worker in errore").length).toBeGreaterThan(0);

    const warningToggle = screen.getAllByRole("checkbox", { name: /warning/i })[0];
    await user.click(warningToggle);

    await waitFor(() => {
      expect(screen.queryAllByText("Dato non valido")).toHaveLength(0);
    });
    expect(screen.queryAllByText("Pipeline avviata").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Worker in errore").length).toBeGreaterThan(0);
  });

  it("permette di filtrare i log per componente", async () => {
    const user = userEvent.setup();
    render(<LogViewer logs={baseLogs} />);

    const componentSelect = screen.getAllByLabelText(/componente/i)[0];
    await user.selectOptions(componentSelect, ["source:scheduler"]);

    expect(screen.queryAllByText("Pipeline avviata").length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.queryAllByText("Dato non valido")).toHaveLength(0);
      expect(screen.queryAllByText("Worker in errore")).toHaveLength(0);
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("esportazione", () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const originalBlob = globalThis.Blob;
    let createObjectURLMock: ReturnType<typeof vi.fn>;
    let revokeObjectURLMock: ReturnType<typeof vi.fn>;
    let clickSpy: ReturnType<typeof vi.spyOn>;
    let blobParts: unknown[];

    beforeEach(() => {
      blobParts = [];
      const StubBlob = class {
        public readonly parts: unknown[];
        public readonly options?: BlobPropertyBag;

        constructor(parts: unknown[], options?: BlobPropertyBag) {
          this.parts = parts;
          this.options = options;
          blobParts = parts;
        }
      };
      Object.defineProperty(globalThis, "Blob", {
        configurable: true,
        writable: true,
        value: StubBlob as unknown as typeof Blob,
      });
      createObjectURLMock = vi.fn().mockReturnValue("blob:export");
      revokeObjectURLMock = vi.fn();
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: createObjectURLMock,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: revokeObjectURLMock,
      });
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    });

    afterEach(() => {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
      Object.defineProperty(globalThis, "Blob", {
        configurable: true,
        writable: true,
        value: originalBlob,
      });
      clickSpy.mockRestore();
    });

    it("esporta i log correnti in formato NDJSON", async () => {
      const user = userEvent.setup();
      render(<LogViewer logs={baseLogs} />);

      const warningToggle = screen.getAllByRole("checkbox", { name: /warning/i })[0];
      await user.click(warningToggle);

      const exportButton = screen.getByRole("button", { name: /esporta log/i });
      await user.click(exportButton);

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(blobParts).not.toHaveLength(0);
      const text = blobParts
        .map((part) => (typeof part === "string" ? part : String(part)))
        .join("");
      const lines = text.split("\n").filter(Boolean);
      expect(lines).toHaveLength(2);
      const parsed = lines.map((line) => JSON.parse(line));
      expect(parsed).toEqual([
        expect.objectContaining({ id: "1", level: "info" }),
        expect.objectContaining({ id: "3", level: "error" }),
      ]);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:export");
    });
  });
});
