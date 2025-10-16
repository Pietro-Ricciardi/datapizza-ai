import React from "react";
import { ReactFlowProvider } from "reactflow";
import { shallow } from "zustand/shallow";

import { EditorCanvas } from "./components/EditorCanvas";
import { Sidebar } from "./components/Sidebar";
import { useEditorStore } from "./state/editorStore";

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
        <ReactFlowProvider>
          <EditorCanvas nodes={nodes} edges={edges} />
        </ReactFlowProvider>
      </main>
    </div>
  );
}
