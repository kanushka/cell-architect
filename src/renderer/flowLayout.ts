import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { CellDiagramModel } from "../domain/cellModel";

type FlowNodeData = Record<string, unknown>;
type BoundaryDirection = "north" | "east" | "south" | "west";

const componentSize = 112;
const externalSize = 106;
const gatewaySize = 34;
const componentWidth = componentSize;
const componentHeight = componentSize;
const cellPadding = 142;
const defaultCellSize = 640;
const externalGapByDirection: Record<BoundaryDirection, number> = {
  north: 220,
  east: 150,
  south: 220,
  west: 150
};
const externalStepByDirection: Record<BoundaryDirection, number> = {
  north: 240,
  east: 172,
  south: 240,
  west: 172
};

function componentLayout(model: CellDiagramModel) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    ranksep: 72,
    nodesep: 44,
    marginx: 20,
    marginy: 20
  });

  model.components.forEach((component) => {
    graph.setNode(component.id, { width: componentWidth, height: componentHeight });
  });

  model.edges
    .filter((edge) => edge.kind === "internal")
    .forEach((edge) => {
      graph.setEdge(edge.source, edge.target);
    });

  dagre.layout(graph);

  const nodes = model.components.map((component) => {
    const position = graph.node(component.id) ?? { x: 0, y: 0 };
    return {
      component,
      x: position.x - componentWidth / 2,
      y: position.y - componentHeight / 2
    };
  });

  const bounds = nodes.reduce(
    (current, node) => ({
      minX: Math.min(current.minX, node.x),
      minY: Math.min(current.minY, node.y),
      maxX: Math.max(current.maxX, node.x + componentWidth),
      maxY: Math.max(current.maxY, node.y + componentHeight)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );

  if (nodes.length === 0) {
    return {
      nodes,
      width: defaultCellSize,
      height: defaultCellSize
    };
  }

  const contentWidth = bounds.maxX - bounds.minX + cellPadding * 2;
  const contentHeight = bounds.maxY - bounds.minY + cellPadding * 2;
  const cellSize = Math.max(defaultCellSize, contentWidth, contentHeight);
  const extraX = (cellSize - contentWidth) / 2;
  const extraY = (cellSize - contentHeight) / 2;

  return {
    nodes: nodes.map((node) => ({
      ...node,
      x: node.x - bounds.minX + cellPadding + extraX,
      y: node.y - bounds.minY + cellPadding + extraY
    })),
    width: cellSize,
    height: cellSize
  };
}

function externalPosition(
  direction: BoundaryDirection,
  index: number,
  count: number,
  cellWidth: number,
  cellHeight: number
) {
  const gap = externalGapByDirection[direction];
  const step = externalStepByDirection[direction];
  const offset = (index - (count - 1) / 2) * step;

  if (direction === "north") {
    return { x: cellWidth / 2 + offset - externalSize / 2, y: -gap };
  }

  if (direction === "south") {
    return { x: cellWidth / 2 + offset - externalSize / 2, y: cellHeight + gap - externalSize };
  }

  if (direction === "west") {
    return { x: -gap - externalSize, y: cellHeight / 2 + offset - externalSize / 2 };
  }

  return { x: cellWidth + gap, y: cellHeight / 2 + offset - externalSize / 2 };
}

function gatewayPosition(direction: BoundaryDirection, cellWidth: number, cellHeight: number) {
  if (direction === "north") {
    return { x: cellWidth / 2 - gatewaySize / 2, y: -gatewaySize / 2 };
  }

  if (direction === "south") {
    return { x: cellWidth / 2 - gatewaySize / 2, y: cellHeight - gatewaySize / 2 };
  }

  if (direction === "west") {
    return { x: -gatewaySize / 2, y: cellHeight / 2 - gatewaySize / 2 };
  }

  return { x: cellWidth - gatewaySize / 2, y: cellHeight / 2 - gatewaySize / 2 };
}

function componentHandle(direction: string, type: "source" | "target") {
  if (direction === "north") {
    return type === "source" ? "component-top-source" : "component-top-target";
  }

  if (direction === "south") {
    return type === "source" ? "component-bottom-source" : "component-top-target";
  }

  if (direction === "west") {
    return type === "source" ? "component-left-source" : "component-left-target";
  }

  return type === "source" ? "component-right-source" : "component-left-target";
}

function externalSourceHandle(direction: string) {
  if (direction === "north") {
    return "external-bottom-source";
  }

  if (direction === "west") {
    return "external-right-source";
  }

  return "external-right-source";
}

function externalTargetHandle(direction: string) {
  if (direction === "south") {
    return "external-top-target";
  }

  return "external-left-target";
}

function gatewaySourceHandle(direction: string) {
  if (direction === "north") {
    return "gateway-bottom-source";
  }

  if (direction === "south") {
    return "gateway-bottom-source";
  }

  if (direction === "west") {
    return "gateway-right-source";
  }

  return "gateway-right-source";
}

function gatewayTargetHandle(direction: string) {
  if (direction === "north") {
    return "gateway-top-target";
  }

  if (direction === "south") {
    return "gateway-top-target";
  }

  if (direction === "west") {
    return "gateway-left-target";
  }

  return "gateway-left-target";
}

function internalEdgeHandles() {
  return {
    sourceHandle: "component-right-source",
    targetHandle: "component-left-target"
  };
}

function connectionData(connectionId: string, connectedNodeIds: string[]) {
  return {
    connectionId,
    connectedNodeIds
  };
}

export function toReactFlow(model: CellDiagramModel) {
  const layout = componentLayout(model);
  const origin = { x: 360, y: 230 };
  const nodes: Node<FlowNodeData>[] = [
    {
      id: "cell-boundary",
      type: "cellBoundary",
      position: origin,
      data: {
        title: model.title,
        version: model.version,
        width: layout.width,
        height: layout.height
      },
      draggable: false,
      selectable: false
    }
  ];

  layout.nodes.forEach(({ component, x, y }) => {
    nodes.push({
      id: component.id,
      type: "component",
      position: { x: origin.x + x, y: origin.y + y },
      data: {
        nodeId: component.id,
        label: component.id,
        componentType: component.type
      },
      draggable: false
    });
  });

  const byDirection = model.externals.reduce<Record<string, string[]>>((groups, external) => {
    groups[external.direction] = [...(groups[external.direction] ?? []), external.id];
    return groups;
  }, {});
  const gatewayDirections = new Set([
    ...Object.keys(byDirection),
    ...model.edges.filter((edge) => edge.kind === "exposure").map((edge) => edge.direction)
  ]);

  Array.from(gatewayDirections).forEach((direction) => {
    const position = gatewayPosition(direction as BoundaryDirection, layout.width, layout.height);
    nodes.push({
      id: `gateway-${direction}`,
      type: "gateway",
      position: {
        x: origin.x + position.x,
        y: origin.y + position.y
      },
      data: {
        nodeId: `gateway-${direction}`,
        direction
      },
      draggable: false
    });
  });

  model.externals.forEach((external) => {
    const peers = byDirection[external.direction] ?? [];
    const position = externalPosition(
      external.direction as BoundaryDirection,
      peers.indexOf(external.id),
      peers.length,
      layout.width,
      layout.height
    );

    nodes.push({
      id: `external-${external.id}`,
      type: "external",
      position: {
        x: origin.x + position.x,
        y: origin.y + position.y
      },
      data: {
        nodeId: `external-${external.id}`,
        label: external.id,
        direction: external.direction
      },
      draggable: false
    });
  });

  const edges: Edge[] = model.edges.flatMap<Edge>((edge) => {
    if (edge.kind === "internal") {
      const handles = internalEdgeHandles();
      const data = connectionData(edge.id, [edge.source, edge.target]);
      return [
        {
          id: edge.id,
          data,
          source: edge.source,
          sourceHandle: handles.sourceHandle,
          target: edge.target,
          targetHandle: handles.targetHandle,
          label: edge.label,
          type: "smoothstep",
          animated: false,
          className: `edge-${edge.direction}`
        }
      ];
    }

    if (edge.kind === "inbound") {
      const gatewayId = `gateway-${edge.direction}`;
      const externalId = `external-${edge.source}`;
      const data = connectionData(edge.id, [externalId, gatewayId, edge.target]);
      return [
        {
          id: `${edge.id}-external-gateway`,
          data,
          source: externalId,
          sourceHandle: externalSourceHandle(edge.direction),
          target: gatewayId,
          targetHandle: gatewayTargetHandle(edge.direction),
          label: edge.label,
          type: "smoothstep",
          animated: true,
          className: `edge-${edge.direction}`
        },
        {
          id: `${edge.id}-gateway-component`,
          data,
          source: gatewayId,
          sourceHandle: gatewaySourceHandle(edge.direction),
          target: edge.target,
          targetHandle: componentHandle(edge.direction, "target"),
          type: "smoothstep",
          animated: true,
          className: `edge-${edge.direction}`
        }
      ];
    }

    if (edge.kind === "exposure") {
      const gatewayId = `gateway-${edge.direction}`;
      const data = connectionData(edge.id, [edge.source, gatewayId]);
      return [
        {
          id: `${edge.id}-component-gateway`,
          data,
          source: edge.source,
          sourceHandle: componentHandle(edge.direction, "source"),
          target: gatewayId,
          targetHandle: gatewayTargetHandle(edge.direction),
          label: edge.label,
          type: "smoothstep",
          animated: true,
          className: `edge-${edge.direction}`
        }
      ];
    }

    const gatewayId = `gateway-${edge.direction}`;
    const externalId = `external-${edge.target}`;
    const data = connectionData(edge.id, [edge.source, gatewayId, externalId]);
    return [
      {
        id: `${edge.id}-component-gateway`,
        data,
        source: edge.source,
        sourceHandle: componentHandle(edge.direction, "source"),
        target: gatewayId,
        targetHandle: gatewayTargetHandle(edge.direction),
        type: "smoothstep",
        animated: true,
        className: `edge-${edge.direction}`
      },
      {
        id: `${edge.id}-gateway-external`,
        data,
        source: gatewayId,
        sourceHandle: gatewaySourceHandle(edge.direction),
        target: externalId,
        targetHandle: externalTargetHandle(edge.direction),
        label: edge.label,
        type: "smoothstep",
        animated: true,
        className: `edge-${edge.direction}`
      }
    ];
  });

  return {
    nodes,
    edges,
    cellSize: {
      width: layout.width,
      height: layout.height
    }
  };
}
