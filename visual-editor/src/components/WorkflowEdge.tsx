import { memo } from "react";
import { SmoothStepEdge, type EdgeProps } from "reactflow";

export const WorkflowEdge = memo((props: EdgeProps) => {
  return <SmoothStepEdge {...props} />;
});

WorkflowEdge.displayName = "WorkflowEdge";

export default WorkflowEdge;
