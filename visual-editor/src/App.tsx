import React from "react";
import { shallow } from "zustand/shallow";
import { useEditorStore } from "./state/editorStore";
import { EditorCanvas } from "./components/EditorCanvas";
import { Sidebar } from "./components/Sidebar";

export default function App(): React.JSX.Element {
  const [nodes, edges] = useEditorStore((state) => [state.nodes, state.edges], shallow);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Datapizza Visual Editor</h1>
        <p className="app-subtitle">
          Standalone playground for orchestrating Datapizza workflows.
        </p>
      </header>
      <main className="app-main">
        <Sidebar />
        <EditorCanvas nodes={nodes} edges={edges} />
      </main>
    </div>
  );
}
