import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Node } from "reactflow";

import { NodeInspector } from "../NodeInspector";
import { useWorkflowStore } from "../../store/workflow-store";

function createNode(overrides?: Partial<Node>): Node {
  return {
    id: "node-1",
    type: "task",
    position: { x: 0, y: 0 },
    data: {
      label: "Dataset",
      component: "datapizza.source.dataset",
      parameters: { format: "parquet" },
    },
    ...overrides,
  } as Node;
}

describe("NodeInspector", () => {
  beforeEach(() => {
    useWorkflowStore.setState({ nodeValidationErrors: {} });
  });

  it("mostra un messaggio chiaro quando il JSON è malformato", async () => {
    const node = createNode();
    const user = userEvent.setup();

    render(<NodeInspector node={node} />);

    const [textarea] = screen.getAllByLabelText(/parametri/i);
    await user.clear(textarea);
    fireEvent.change(textarea, { target: { value: "{\n  invalid" } });
    fireEvent.blur(textarea);

    expect(screen.queryAllByText(/Parametri non validi: /i).length).toBeGreaterThan(0);
  });

  it("blocca il salvataggio quando i parametri non rispettano lo schema", async () => {
    const node = createNode();
    const user = userEvent.setup();
    const updateSpy = vi.spyOn(useWorkflowStore.getState(), "updateNodeParameters");

    render(<NodeInspector node={node} />);

    const [textarea] = screen.getAllByLabelText(/parametri/i);
    await user.clear(textarea);
    fireEvent.change(textarea, { target: { value: "{}" } });
    fireEvent.blur(textarea);

    const errors = screen.getAllByText(/Manca il campo obbligatorio "format"/i);
    expect(errors.length).toBeGreaterThan(0);
    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();
  });

  it("propaga gli errori di validazione dello store", () => {
    useWorkflowStore.setState({
      nodeValidationErrors: {
        "node-1": ['Manca il campo obbligatorio "format".'],
      },
    });

    const node = createNode();

    render(<NodeInspector node={node} />);

    const storeErrors = screen.getAllByText(
      /Parametri non validi: Manca il campo obbligatorio "format"\./i,
    );
    expect(storeErrors.length).toBeGreaterThan(0);
  });

  it("salva i parametri quando lo schema è soddisfatto", async () => {
    const node = createNode();
    const user = userEvent.setup();
    const updateSpy = vi.spyOn(useWorkflowStore.getState(), "updateNodeParameters");

    render(<NodeInspector node={node} />);

    const [textarea] = screen.getAllByLabelText(/parametri/i);
    await user.clear(textarea);
    fireEvent.change(textarea, { target: { value: '{"format":"csv"}' } });
    fireEvent.blur(textarea);

    expect(screen.queryByText(/Parametri non validi/i)).toBeNull();
    expect(updateSpy).toHaveBeenCalledWith("node-1", { format: "csv" });
    updateSpy.mockRestore();
  });
});
