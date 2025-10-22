import { memo, useMemo } from "react";
import {
  FixedSizeList,
  type ListChildComponentProps,
} from "react-window";

type ValidationSummary = {
  severity: "error" | "warning";
  count: number;
  messages: string[];
};

export interface NodeStatusItem {
  id: string;
  label: string;
  status: string;
  labelText: string;
  details?: string;
  validationSummary?: ValidationSummary;
}

interface NodeStatusListProps {
  items: NodeStatusItem[];
  maxVisibleItems?: number;
  itemHeight?: number;
  emptyMessage?: string;
}

const DEFAULT_ITEM_HEIGHT = 104;
const DEFAULT_MAX_VISIBLE_ITEMS = 7;

const NodeStatusRow = memo(
  ({ index, style, data }: ListChildComponentProps<NodeStatusItem[]>) => {
    const item = data[index];
    const validation = item.validationSummary;

    return (
      <div
        style={style}
        className={`status-list__item status-list__item--${item.status}`}
        role="listitem"
      >
        <div className="status-list__header">
          <span className="status-list__name">{item.label}</span>
          <span className={`status-badge status-badge--${item.status}`}>
            {item.labelText}
          </span>
        </div>
        {validation ? (
          <div
            className={`status-list__validation status-list__validation--${validation.severity}`}
            title={validation.messages.join("\n")}
          >
            {validation.severity === "error" ? "Problemi critici" : "Avvisi"}
            <span className="status-list__validation-count">
              {validation.count}
            </span>
          </div>
        ) : null}
        {item.details ? (
          <p className="status-list__details">{item.details}</p>
        ) : null}
      </div>
    );
  },
);
NodeStatusRow.displayName = "NodeStatusRow";

export function NodeStatusList({
  items,
  maxVisibleItems = DEFAULT_MAX_VISIBLE_ITEMS,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  emptyMessage = "Nessun nodo presente nel workflow.",
}: NodeStatusListProps): JSX.Element {
  const hasItems = items.length > 0;

  const listHeight = useMemo(() => {
    const visibleItems = Math.min(items.length, maxVisibleItems);
    return Math.max(visibleItems, 1) * itemHeight;
  }, [itemHeight, items.length, maxVisibleItems]);

  if (!hasItems) {
    return <p className="muted-copy">{emptyMessage}</p>;
  }

  return (
    <div className="status-list status-list--virtualized" role="list">
      <FixedSizeList
        height={listHeight}
        width="100%"
        itemCount={items.length}
        itemSize={itemHeight}
        itemData={items}
      >
        {NodeStatusRow}
      </FixedSizeList>
    </div>
  );
}

export default NodeStatusList;
