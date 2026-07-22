# Live DSL Diagram Motion Design

## Goal

Make building a cell diagram through DSL edits feel responsive and playful without making the graph harder to follow. When a valid structural edit changes the diagram, new circles should arrive with a soft zoom, existing circles should glide to their new layout positions, and new connections should draw in shortly after their endpoints appear.

## Scope

This change applies to valid structural edits within the currently open diagram:

- adding a component, external dependency, gateway, or connection;
- changing graph structure in a way that repositions an existing node; and
- resizing or repositioning the cell boundary as a consequence of layout.

Text-only changes such as renaming a component or changing its displayed type update without entrance motion. The initial render, switching between saved diagrams, importing a diagram, and returning to the diagram tab should present the complete graph without replaying the construction sequence.

Removed nodes and edges disappear immediately. Exit animation is deliberately excluded because retaining removed graph elements as temporary visual state would complicate rapid live editing and interaction semantics.

## Motion Direction

The visual direction is a restrained, playful construction sequence:

1. Existing nodes glide from their old positions to the positions produced by the new layout over approximately 300 milliseconds.
2. Newly added component and external circles enter over approximately 360 milliseconds, starting near 70% scale and zero opacity, easing slightly past full size, then settling at 100%.
3. Newly introduced gateway circles use the same entrance treatment at a smaller visual scale.
4. New connection paths draw from source to target over approximately 220 milliseconds, beginning after a short 60–90 millisecond delay so the endpoint circle reads first.
5. New edge labels fade in with the latter half of the connection animation.

Motion uses a single coherent easing family. It should feel soft and energetic, not elastic or distracting. Existing focus-view highlighting continues to use its current fast opacity and emphasis transitions.

## Architecture

`DiagramCanvas` remains the owner of graph presentation. A small motion-classification unit compares stable node and edge IDs from the previously rendered flow with the next flow and returns the IDs that are new. Stable IDs already exist for components, externals, gateways, and connections, so no DSL or domain-model changes are required.

The classification distinguishes three situations:

- **Initial or context render:** no entrance classes are applied.
- **Same-document structural update:** new node and edge IDs receive one-shot entrance classes, while surviving node wrappers receive positional transitions.
- **Display-only update:** label and subtype content changes in place with no entrance classes.

The active document ID is not currently passed to `DiagramCanvas`. The implementation should add an explicit context key supplied by `App`, rather than guessing a document switch from graph contents. A change to that key resets motion history and suppresses construction animations for the incoming document. The existing `fitKey` remains responsible only for visible-layout fitting.

The motion state must not feed back into `toReactFlow` or Dagre. Layout remains deterministic and synchronous; animation only controls how the browser presents the transition between the previous and next computed layouts.

## Rendering Details

React Flow owns the transform on each `.react-flow__node` wrapper. Positional transition styling therefore belongs on that wrapper, while entrance scale and opacity belong on the inner `.component-node`, `.external-node`, and `.gateway-node` elements. Keeping these transform responsibilities separate prevents a zoom entrance from overriding React Flow's positioning transform.

New node and edge classifications are exposed as additional class names or data attributes on the existing React Flow node and edge objects. CSS keyframes perform the one-shot entrances. New paths use `stroke-dasharray` and `stroke-dashoffset` so their geometry can draw in without a JavaScript animation loop.

The cell boundary does not pop. Its position and dimensions transition smoothly so it continues to read as the stable container around the animated contents.

The existing automatic `fitView` behavior remains in place. Its current 200 millisecond viewport adjustment runs alongside graph motion, but it must not re-trigger merely because motion classification state changes.

## Rapid Editing and Invalid DSL

Each valid compiled model is compared with the last valid rendered model. If the user types through a temporarily invalid state, `App` continues showing the last valid graph, as it does today. When the source becomes valid again, only IDs genuinely added relative to that last valid graph receive entrance motion.

If another edit arrives before an animation finishes, the latest React Flow positions replace the target positions and CSS transitions continue toward the newest target. Motion classification is recalculated from the most recently rendered valid ID sets, preventing an existing node from repeatedly replaying its entrance.

## Accessibility and Performance

A `prefers-reduced-motion: reduce` media query disables node position transitions, entrance keyframes, edge drawing, and boundary resizing. All content appears immediately and remains fully usable.

The implementation remains CSS-first and adds no animation dependency. ID comparison is linear in the number of nodes and edges and should be memoized with the existing flow conversion. No request-animation-frame loop is introduced.

Animations use only transform, opacity, and SVG stroke offset where possible. Boundary dimensions are the limited exception. Interaction, pointer targeting, keyboard behavior, export output, and focus-view selection must remain unchanged.

## Testing

Unit and component tests should cover:

- the first render does not classify every graph item as newly added;
- adding a component marks only that component as entering;
- adding a connection marks only that connection as entering;
- surviving nodes retain their identity and receive positional-transition styling;
- label-only edits do not replay node or edge entrances;
- changing the document context key resets history and suppresses entrances;
- a valid model following a temporarily invalid edit compares against the last valid rendered graph;
- reduced-motion CSS removes the transition and animation declarations; and
- existing zoom, fit-view, focus highlighting, and export tests remain green.

A browser-level visual check should verify the choreography with rapid typing, a component added between existing connected nodes, an external dependency addition on each boundary direction, and a graph large enough to resize the cell boundary.

## Acceptance Criteria

- A newly declared component or external dependency visibly zooms and fades into place once.
- Existing circles glide to their new layout positions rather than jumping.
- A newly declared connection visibly draws in after its endpoint nodes appear.
- Renaming or changing displayed type text does not replay entrance animation.
- Initial load and document switches do not animate the whole graph as if it were newly constructed.
- Rapid edits converge cleanly on the latest valid layout without repeated entrance effects.
- Reduced-motion users see immediate, non-animated updates.
- Diagram focus, zoom, viewport fitting, exports, and responsive layouts continue to work.
