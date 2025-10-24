import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  WORKFLOW_TEMPLATE_CATEGORIES,
  type NodeTemplate,
  type WorkflowTemplate,
} from "../data/workflow-templates";
import {
  useTemplateCatalogFilters,
  type TemplateCatalogTagMetadata,
} from "../hooks/useTemplateCatalogFilters";
import type { Locale, Translations } from "../i18n/resources";

export type TemplateCatalogProps = {
  open: boolean;
  templates: WorkflowTemplate[];
  activeTemplateId: string;
  nodeTemplates: NodeTemplate[];
  onClose: () => void;
  onApplyTemplate: (templateId: string) => void;
  onNodeDragStart: (event: DragEvent<HTMLElement>, template: NodeTemplate) => void;
  translations: Translations[Locale];
};

const formatTagLabel = (tag: string): string => {
  const category = WORKFLOW_TEMPLATE_CATEGORIES[
    tag as keyof typeof WORKFLOW_TEMPLATE_CATEGORIES
  ];
  if (category) {
    return category.label;
  }
  return tag
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const formatTagAriaLabel = (tag: TemplateCatalogTagMetadata, label: string): string =>
  `${label}: ${tag.count}`;

export function TemplateCatalog({
  open,
  templates,
  activeTemplateId,
  nodeTemplates,
  onClose,
  onApplyTemplate,
  onNodeDragStart,
  translations,
}: TemplateCatalogProps) {
  const { library } = translations;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const {
    filteredTemplates,
    filteredNodeTemplates,
    nodeGroups,
    tags,
    totalResults,
  } = useTemplateCatalogFilters({
    templates,
    nodeTemplates,
    searchQuery,
    selectedTags,
  });

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = "template-catalog-title";
  const dialogDescriptionId = "template-catalog-description";

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [open, onClose]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const toggleTag = (value: string) => {
    setSelectedTags((current) => {
      if (current.includes(value)) {
        return current.filter((tag) => tag !== value);
      }
      return [...current, value];
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
  };

  const workflowsCount = filteredTemplates.length;
  const nodesCount = filteredNodeTemplates.length;
  const hasFiltersActive = searchQuery.trim().length > 0 || selectedTags.length > 0;
  const tagsAvailable = tags.length > 0;

  const sortedNodeGroups = useMemo(() => Object.entries(nodeGroups), [nodeGroups]);

  const resultsSummary = useMemo(() => library.resultsSummary(totalResults), [library, totalResults]);

  return (
    <aside
      className={`library-drawer${open ? " library-drawer--open" : ""}`}
      aria-hidden={!open}
      aria-modal={open ? true : undefined}
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogDescriptionId}
      aria-label={library.ariaLabel}
      role="dialog"
      tabIndex={-1}
      data-tour-id="guided-tour-catalog"
    >
      <div className="library-drawer__header">
        <div>
          <p className="library-drawer__eyebrow" id={dialogDescriptionId}>
            {library.eyebrow}
          </p>
          <h2 className="library-drawer__title" id={dialogTitleId}>
            {library.title}
          </h2>
        </div>
        <button
          ref={closeButtonRef}
          className="button button--ghost library-drawer__close"
          type="button"
          onClick={onClose}
          aria-label={library.closeLabel}
        >
          {library.close}
        </button>
      </div>
      <div className="library-drawer__content">
        <section className="template-catalog__filters" aria-label={library.filtersAriaLabel}>
          <label className="template-catalog__search-label" htmlFor="template-catalog-search">
            {library.searchLabel}
          </label>
          <input
            id="template-catalog-search"
            type="search"
            className="template-catalog__search"
            placeholder={library.searchPlaceholder}
            value={searchQuery}
            onChange={handleSearchChange}
          />
          <div className="template-catalog__tags-header">
            <h3>{library.filtersTitle}</h3>
            {hasFiltersActive ? (
              <button
                type="button"
                className="button button--ghost template-catalog__clear-filters"
                onClick={clearFilters}
              >
                {library.clearFilters}
              </button>
            ) : null}
          </div>
          <ul className="template-catalog__tags">
            {tagsAvailable ? (
              tags.map((tag) => {
                const label = formatTagLabel(tag.value);
                const selected = selectedTags.includes(tag.value);
                return (
                  <li key={tag.value}>
                    <button
                      type="button"
                      className={`template-catalog__tag${
                        selected ? " template-catalog__tag--selected" : ""
                      }`}
                      onClick={() => toggleTag(tag.value)}
                      aria-pressed={selected}
                      aria-label={formatTagAriaLabel(tag, label)}
                    >
                      <span className="template-catalog__tag-label">{label}</span>
                      <span className="template-catalog__tag-count">{tag.count}</span>
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="template-catalog__tags-empty">{library.tagsEmpty}</li>
            )}
          </ul>
          <p className="template-catalog__results" aria-live="polite">
            {resultsSummary}
          </p>
        </section>
        {totalResults === 0 ? (
          <div className="template-catalog__empty">
            <h3>{library.emptyStateTitle}</h3>
            <p>{library.emptyStateDescription}</p>
          </div>
        ) : null}
        <section className="library-drawer__section">
          <header>
            <div className="template-catalog__section-title">
              <h3>{library.workflowsTitle}</h3>
              <span
                className="template-catalog__result-badge"
                aria-label={`${library.workflowsResultLabel}: ${workflowsCount}`}
              >
                {workflowsCount}
              </span>
            </div>
            <p>{library.workflowsDescription}</p>
          </header>
          {workflowsCount === 0 ? (
            <p className="template-catalog__empty-section">{library.workflowsEmpty}</p>
          ) : (
            <div className="template-grid">
              {filteredTemplates.map((template) => {
                const category =
                  WORKFLOW_TEMPLATE_CATEGORIES[template.category] ??
                  ({ label: template.category, description: "" } as const);
                const isActive = template.id === activeTemplateId;
                return (
                  <article
                    key={template.id}
                    className={`template-card${isActive ? " template-card--active" : ""}`}
                  >
                    <div className="template-card__header">
                      <span className="template-card__icon" aria-hidden>
                        {template.icon}
                      </span>
                      <div>
                        <h4>{template.name}</h4>
                        <p>{template.description}</p>
                      </div>
                    </div>
                    <div className="template-card__footer">
                      <span className="template-card__badge">{category.label}</span>
                      <button
                        className="button button--ghost template-card__action"
                        type="button"
                        onClick={() => onApplyTemplate(template.id)}
                        aria-pressed={isActive}
                      >
                        {isActive ? library.reload : library.apply}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <section className="library-drawer__section">
          <header>
            <div className="template-catalog__section-title">
              <h3>{library.nodesTitle}</h3>
              <span
                className="template-catalog__result-badge"
                aria-label={`${library.nodesResultLabel}: ${nodesCount}`}
              >
                {nodesCount}
              </span>
            </div>
            <p>{library.nodesDescription}</p>
          </header>
          {nodesCount === 0 ? (
            <p className="template-catalog__empty-section">{library.nodesEmpty}</p>
          ) : (
            <div className="node-template-groups">
              {sortedNodeGroups.map(([categoryKey, nodes]) => {
                if (nodes.length === 0) {
                  return null;
                }
                const category =
                  WORKFLOW_TEMPLATE_CATEGORIES[
                    categoryKey as keyof typeof WORKFLOW_TEMPLATE_CATEGORIES
                  ] ?? { label: categoryKey, description: "" };
                return (
                  <div key={categoryKey} className="node-template-group">
                    <div className="node-template-group__header">
                      <span className="node-template-group__badge">{category.label}</span>
                      <p>{category.description}</p>
                    </div>
                    <div className="node-template-list">
                      {nodes.map((node) => (
                        <button
                          key={node.id}
                          type="button"
                          className="node-template"
                          draggable
                          onDragStart={(event) => onNodeDragStart(event, node)}
                        >
                          <span className="node-template__icon" aria-hidden>
                            {node.icon}
                          </span>
                          <span className="node-template__content">
                            <span className="node-template__title">{node.label}</span>
                            <span className="node-template__description">{node.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

export default TemplateCatalog;
