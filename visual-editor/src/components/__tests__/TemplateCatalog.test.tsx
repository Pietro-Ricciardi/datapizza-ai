import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TemplateCatalog } from "../TemplateCatalog";
import {
  NODE_TEMPLATES,
  WORKFLOW_TEMPLATES,
} from "../../data/workflow-templates";
import { translations } from "../../i18n/resources";

const baseProps = {
  open: true,
  templates: WORKFLOW_TEMPLATES,
  activeTemplateId: WORKFLOW_TEMPLATES[0].id,
  nodeTemplates: NODE_TEMPLATES,
  onClose: vi.fn(),
  onApplyTemplate: vi.fn(),
  onNodeDragStart: vi.fn(),
  translations: translations.it,
};

describe("TemplateCatalog", () => {
  afterEach(() => {
    cleanup();
  });

  it("filtra workflow e nodi in base alla ricerca", async () => {
    const user = userEvent.setup();
    render(<TemplateCatalog {...baseProps} />);

    const searchInput = screen.getByLabelText(/filtra catalogo/i);
    await user.type(searchInput, "notific");

    expect(screen.queryByText("Orchestrazione event-driven")).not.toBeNull();
    expect(screen.queryByText("Pipeline ML supervisionata")).toBeNull();
    expect(screen.queryByText("Notifica team")).not.toBeNull();
    expect(screen.queryByText("Carica dataset")).toBeNull();
  });

  it("permette di filtrare il catalogo tramite tag", async () => {
    const user = userEvent.setup();
    render(<TemplateCatalog {...baseProps} />);

    const machineLearningTag = screen.getByRole("button", { name: /machine learning/i });
    await user.click(machineLearningTag);

    expect(machineLearningTag).toBeDefined();
    expect(machineLearningTag.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Pipeline ML supervisionata")).not.toBeNull();
    expect(screen.queryByText("ETL refresh giornaliero")).toBeNull();
    expect(screen.queryByText("Feature engineering")).not.toBeNull();
    expect(screen.queryByText("Estrai CSV")).toBeNull();
  });

  it("combina ricerca e tag per restringere i risultati", async () => {
    const user = userEvent.setup();
    render(<TemplateCatalog {...baseProps} />);

    const orchestrationTag = screen
      .getAllByRole("button")
      .find((button) => button.getAttribute("aria-label")?.toLowerCase().includes("orches"));
    expect(orchestrationTag).toBeDefined();
    await user.click(orchestrationTag!);

    const searchInput = screen.getByLabelText(/filtra catalogo/i);
    await user.type(searchInput, "notific");

    expect(screen.queryByText("Orchestrazione event-driven")).not.toBeNull();
    expect(screen.queryByText("ETL refresh giornaliero")).toBeNull();
    expect(screen.queryByText("Notifica team")).not.toBeNull();
    expect(screen.queryByText("Trigger branch")).toBeNull();

    expect(screen.getByLabelText(/workflow trovati/i).textContent).toBe("1");
    expect(screen.getByLabelText(/nodi trovati/i).textContent).toBe("1");
  });
});
