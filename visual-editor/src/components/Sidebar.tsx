import React from "react";
import { useEditorStore } from "../state/editorStore";

export function Sidebar(): React.JSX.Element {
  const addNode = useEditorStore((state) => state.addNode);

  return (
    <aside className="sidebar" aria-label="Available nodes">
      <h2>Node Library</h2>
      <p>Scaffold placeholder. Use this area to add new nodes to the canvas.</p>
      <button
        type="button"
        className="sidebar__button"
        onClick={() => addNode()}
      >
        Add sample node
      </button>
    </aside>
  );
}
