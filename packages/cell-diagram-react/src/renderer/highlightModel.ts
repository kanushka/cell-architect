interface HighlightableEdge {
  id: string;
  data?: Record<string, unknown> | null;
}

export function edgeConnectionId(edge: HighlightableEdge) {
  return String(edge.data?.connectionId ?? edge.id);
}

export function connectionIdsForNode(edges: HighlightableEdge[], nodeId: string) {
  return Array.from(
    new Set(
      edges
        .filter((edge) => {
          const connectedNodeIds = edge.data?.connectedNodeIds;
          return Array.isArray(connectedNodeIds) && connectedNodeIds.map(String).includes(nodeId);
        })
        .map(edgeConnectionId)
    )
  );
}

export function highlightedNodeIdsForConnections(edges: HighlightableEdge[], connectionIds: Set<string>) {
  return edges.reduce<Set<string>>((nodeIds, edge) => {
    const connectedNodeIds = edge.data?.connectedNodeIds;

    if (connectionIds.has(edgeConnectionId(edge)) && Array.isArray(connectedNodeIds)) {
      connectedNodeIds.forEach((nodeId) => nodeIds.add(String(nodeId)));
    }

    return nodeIds;
  }, new Set<string>());
}
