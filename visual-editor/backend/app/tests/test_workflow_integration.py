from app.executor import DatapizzaWorkflowExecutor
from app.models import WorkflowDefinition, WorkflowNodeDefinition, WorkflowPoint

WORKFLOW_COMPONENT = "datapizza.modules.parsers.text_parser.parse_text"


def build_workflow(component_path: str, text: str) -> WorkflowDefinition:
    node = WorkflowNodeDefinition(
        id="bbox-merger",
        kind="task",
        label="Merge Bounding Boxes",
        position=WorkflowPoint(x=0, y=0),
        data={
            "component": component_path,
            "parameters": {"text": text},
        },
    )
    return WorkflowDefinition(metadata={"name": "BBox Integration"}, nodes=[node], edges=[])


def test_bbox_merger_workflow_integration():
    text = "First paragraph. Second sentence.\n\nAnother paragraph."

    workflow = build_workflow(WORKFLOW_COMPONENT, text)
    executor = DatapizzaWorkflowExecutor()

    result = executor.run(workflow)

    assert result.status == "success"
    task_output = result.outputs["results"]["task"]["bbox-merger"]
    assert task_output["metadata"] == {}
    assert len(task_output["children"]) == 2
    first_paragraph = task_output["children"][0]
    assert first_paragraph["metadata"]["index"] == 0
    sentences = [child["metadata"]["text"] for child in first_paragraph["children"]]
    assert sentences == ["First paragraph.", "Second sentence."]
