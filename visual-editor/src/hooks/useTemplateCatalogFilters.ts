import { useMemo } from "react";
import {
  filterNodeTemplates,
  filterWorkflowTemplates,
  getTemplateCatalogTags,
  groupNodeTemplatesByCategory,
  type NodeTemplate,
  type TemplateCatalogFilterState,
  type WorkflowTemplate,
  type WorkflowTemplateCategory,
} from "../data/workflow-templates";

export interface TemplateCatalogTagMetadata {
  value: string;
  count: number;
}

export interface UseTemplateCatalogFiltersParams {
  templates: WorkflowTemplate[];
  nodeTemplates: NodeTemplate[];
  searchQuery: string;
  selectedTags: string[];
}

export interface UseTemplateCatalogFiltersResult {
  filteredTemplates: WorkflowTemplate[];
  filteredNodeTemplates: NodeTemplate[];
  nodeGroups: Record<WorkflowTemplateCategory, NodeTemplate[]>;
  tags: TemplateCatalogTagMetadata[];
  totalResults: number;
}

const normalizeFilters = ({
  searchQuery,
  selectedTags,
}: Pick<TemplateCatalogFilterState, "searchQuery" | "selectedTags">): TemplateCatalogFilterState => ({
  searchQuery: searchQuery.trim(),
  selectedTags,
});

export function useTemplateCatalogFilters({
  templates,
  nodeTemplates,
  searchQuery,
  selectedTags,
}: UseTemplateCatalogFiltersParams): UseTemplateCatalogFiltersResult {
  const filters = useMemo(
    () => normalizeFilters({ searchQuery, selectedTags }),
    [searchQuery, selectedTags],
  );

  const filteredTemplates = useMemo(
    () => filterWorkflowTemplates(templates, filters),
    [templates, filters],
  );

  const filteredNodeTemplates = useMemo(
    () => filterNodeTemplates(nodeTemplates, filters),
    [nodeTemplates, filters],
  );

  const nodeGroups = useMemo(
    () => groupNodeTemplatesByCategory(filteredNodeTemplates),
    [filteredNodeTemplates],
  );

  const tags = useMemo(() => {
    const counts = getTemplateCatalogTags(templates, nodeTemplates);
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [templates, nodeTemplates]);

  return {
    filteredTemplates,
    filteredNodeTemplates,
    nodeGroups,
    tags,
    totalResults: filteredTemplates.length + filteredNodeTemplates.length,
  };
}
