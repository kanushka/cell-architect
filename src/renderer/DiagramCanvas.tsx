import {
  Background,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  getBezierPath
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { CellDiagramModel } from "../domain/cellModel";
import { FitScreenIcon, ZoomInIcon, ZoomOutIcon } from "../ui/ControlIcons";
import { toReactFlow } from "./flowLayout";
import { connectionIdsForNode, edgeConnectionId, highlightedNodeIdsForConnections } from "./highlightModel";

function CellBoundaryNode({ data }: NodeProps) {
  const width = Number(data.width);
  const height = Number(data.height);
  const title = typeof data.title === "string" && data.title.trim() ? data.title : undefined;
  const version = typeof data.version === "string" && data.version.trim() ? data.version : undefined;

  return (
    <div className="cell-boundary" data-cell-shape="octagon" style={{ width, height }}>
      <svg className="cell-boundary__outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon
          data-cell-outline="octagon"
          points="30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {title || version ? (
        <div className="cell-boundary__title" data-cell-title-placement="northwest-outside">
          {title ? <span>{title}</span> : null}
          {version ? <small>{version}</small> : null}
        </div>
      ) : null}
      <div className="cell-gate-label cell-gate-label--north" data-gate-label="north" data-gate-placement="outside">
        North
      </div>
      <div className="cell-gate-label cell-gate-label--east" data-gate-label="east" data-gate-placement="outside">
        East
      </div>
      <div className="cell-gate-label cell-gate-label--south" data-gate-label="south" data-gate-placement="outside">
        South
      </div>
      <div className="cell-gate-label cell-gate-label--west" data-gate-label="west" data-gate-placement="outside">
        West
      </div>
    </div>
  );
}

function ComponentNode({ data }: NodeProps) {
  const nodeId = String(data.nodeId);
  const componentType =
    typeof data.componentType === "string" && data.componentType.trim() ? data.componentType : undefined;

  return (
    <div className="component-node" data-node-shape="circle" data-diagram-node-id={nodeId}>
      <Handle id="component-top-target" type="target" position={Position.Top} />
      <Handle id="component-top-source" type="source" position={Position.Top} />
      <Handle id="component-left-target" type="target" position={Position.Left} />
      <Handle id="component-left-source" type="source" position={Position.Left} />
      <span>{String(data.label)}</span>
      {componentType ? <small>{componentType}</small> : null}
      <Handle id="component-right-source" type="source" position={Position.Right} />
      <Handle id="component-bottom-source" type="source" position={Position.Bottom} />
    </div>
  );
}

function ExternalNode({ data }: NodeProps) {
  const direction = String(data.direction);
  const nodeId = String(data.nodeId);

  return (
    <div className={`external-node external-node--${direction}`} data-external-shape="circle" data-diagram-node-id={nodeId}>
      <Handle id="external-left-target" type="target" position={Position.Left} />
      <Handle id="external-top-target" type="target" position={Position.Top} />
      <span>{String(data.label)}</span>
      {data.externalType ? <small>{String(data.externalType)}</small> : null}
      <Handle id="external-right-source" type="source" position={Position.Right} />
      <Handle id="external-bottom-source" type="source" position={Position.Bottom} />
    </div>
  );
}

function GatewayNode({ data }: NodeProps) {
  const direction = String(data.direction);
  const nodeId = String(data.nodeId);

  return (
    <div className={`gateway-node gateway-node--${direction}`} data-gateway-bound={direction} data-diagram-node-id={nodeId}>
      <Handle id="gateway-top-target" type="target" position={Position.Top} />
      <Handle id="gateway-left-target" type="target" position={Position.Left} />
      <Handle id="gateway-right-source" type="source" position={Position.Right} />
      <Handle id="gateway-bottom-source" type="source" position={Position.Bottom} />
    </div>
  );
}

function LabeledEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath(props);

  return (
    <>
      <path className="react-flow__edge-path" d={edgePath} markerEnd={props.markerEnd} />
      {props.label ? (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`
            }}
          >
            {props.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const nodeTypes = {
  cellBoundary: memo(CellBoundaryNode),
  component: memo(ComponentNode),
  external: memo(ExternalNode),
  gateway: memo(GatewayNode)
};

const edgeTypes = {
  smoothstep: memo(LabeledEdge)
};

function sameConnectionIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export interface DiagramCanvasInsets {
  left: number;
  right: number;
}

const DEFAULT_INSETS: DiagramCanvasInsets = { left: 0, right: 0 };
const FIT_VIEW_VERTICAL_PADDING: `${number}px` = "112px";
const FIT_VIEW_LEFT_PADDING = 112;

interface FitPadding {
  top: `${number}px`;
  bottom: `${number}px`;
  left: `${number}px`;
  right: `${number}px`;
}

function buildFitPadding(insets: DiagramCanvasInsets): FitPadding {
  const leftPadding = insets.left > 0 ? insets.left + FIT_VIEW_LEFT_PADDING : 0;

  return {
    top: FIT_VIEW_VERTICAL_PADDING,
    bottom: FIT_VIEW_VERTICAL_PADDING,
    left: `${leftPadding}px`,
    right: `${insets.right}px`
  };
}

function FitViewController({
  insets,
  model,
  fitKey
}: {
  insets: DiagramCanvasInsets;
  model: CellDiagramModel;
  fitKey?: string;
}) {
  const { fitView } = useReactFlow();
  const { left, right } = insets;

  useEffect(() => {
    const fitOptions = { padding: buildFitPadding({ left, right }), duration: 200 };
    fitView(fitOptions);
    const postPaintFit = window.requestAnimationFrame(() => fitView(fitOptions));

    // model is only used to re-trigger the fit when the diagram data itself changes
    // (switching documents), not on every re-render (e.g. focus-click highlighting).
    return () => window.cancelAnimationFrame(postPaintFit);
  }, [left, right, fitView, model, fitKey]);

  return null;
}

function ZoomControls({ insets }: { insets: DiagramCanvasInsets }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="zoom-controls">
      <button type="button" className="zoom-controls__button" aria-label="Zoom out" onClick={() => zoomOut()}>
        <ZoomOutIcon size={16} />
      </button>
      <span className="zoom-controls__level">{Math.round(zoom * 100)}%</span>
      <button type="button" className="zoom-controls__button" aria-label="Zoom in" onClick={() => zoomIn()}>
        <ZoomInIcon size={16} />
      </button>
      <button
        type="button"
        className="zoom-controls__button zoom-controls__button--fit"
        aria-label="Fit diagram to view"
        onClick={() => fitView({ padding: buildFitPadding(insets), duration: 200 })}
      >
        <FitScreenIcon size={16} />
      </button>
    </div>
  );
}

interface DiagramCanvasProps {
  model: CellDiagramModel | null;
  insets?: DiagramCanvasInsets;
  fitKey?: string;
}

export function DiagramCanvas({ model, insets = DEFAULT_INSETS, fitKey }: DiagramCanvasProps) {
  const [activeConnectionIds, setActiveConnectionIds] = useState<string[]>([]);
  const flow = useMemo<ReturnType<typeof toReactFlow>>(
    () => (model ? toReactFlow(model) : { nodes: [], edges: [], cellSize: { width: 0, height: 0 } }),
    [model]
  );
  const activeConnectionIdSet = useMemo(() => new Set(activeConnectionIds), [activeConnectionIds]);
  const highlightedNodeIds = useMemo(() => {
    if (activeConnectionIdSet.size === 0) {
      return new Set<string>();
    }

    return highlightedNodeIdsForConnections(flow.edges, activeConnectionIdSet);
  }, [activeConnectionIdSet, flow.edges]);
  const getConnectionIdsForNode = useCallback(
    (nodeId: string) => connectionIdsForNode(flow.edges, nodeId),
    [flow.edges]
  );
  const setActiveConnections = useCallback((connectionIds: string[]) => {
    setActiveConnectionIds((current) => (sameConnectionIds(current, connectionIds) ? current : connectionIds));
  }, []);
  const isFocusView = activeConnectionIdSet.size > 0;
  const nodes = useMemo<Node[]>(
    () =>
      flow.nodes.map((node) => ({
        ...node,
        className: isFocusView
          ? highlightedNodeIds.has(node.id)
            ? "connection-highlight-node"
            : "connection-dimmed-node"
          : node.className
      })),
    [flow.nodes, highlightedNodeIds, isFocusView]
  );
  const edges = useMemo<Edge[]>(
    () =>
      flow.edges.map((edge) => ({
        ...edge,
        className: [
          edge.className,
          isFocusView
            ? activeConnectionIdSet.has(edgeConnectionId(edge))
              ? "connection-highlight-edge"
              : "connection-dimmed-edge"
            : ""
        ]
          .filter(Boolean)
          .join(" ")
      })),
    [activeConnectionIdSet, flow.edges, isFocusView]
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveConnections([]);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveConnections]);

  if (!model) {
    return (
      <div className="empty-canvas">
        <span>Fix the DSL errors to render the diagram.</span>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.25}
        maxZoom={1.35}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => setActiveConnections(getConnectionIdsForNode(node.id))}
        onPaneClick={() => setActiveConnections([])}
      >
        <FitViewController insets={insets} model={model} fitKey={fitKey} />
        <Background color="#cbd5e1" gap={22} />
        <ZoomControls insets={insets} />
        <div className="focus-hint" data-focus-mode={isFocusView ? "active" : "idle"}>
          {isFocusView
            ? "Focus view: click outside or press Esc to return to the full diagram."
            : "Click a component to focus its connections."}
        </div>
      </ReactFlow>
    </ReactFlowProvider>
  );
}
