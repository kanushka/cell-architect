# Canvas Notification Slot — Design

Date: 2026-07-22

## Overview

The temporary manual-layout warning currently occupies a persistent banner near
the top of the diagram, while focus guidance and reset feedback use two other
locations. This change consolidates those messages into the existing
bottom-center focus-hint position.

The result is one notification slot with transient pop-up messages. When no
message is active, it continues to show the normal component-focus guidance.

## Goals

- Use the existing bottom-center focus-hint location for canvas messages.
- Make the temporary-layout warning noticeable without leaving it permanently
  over the diagram.
- Warn after the first manual movement and again when the DSL editor receives
  focus while manual layout is active.
- Use the same slot for layout-reset and Auto arrange feedback.
- Restore the correct focus hint after each transient message expires.

## Non-goals

- A general application-wide toast framework.
- A notification history, queue viewer, or dismiss button.
- Repeating the warning after every component drag.
- Blocking DSL editing with a confirmation dialog.

## Behavior

The bottom-center slot has two modes:

1. **Hint mode** — its resting state.
   - Normal canvas: `Click a component to focus its connections.`
   - Focus view: `Focus view: click outside or press Esc to return to the full diagram.`
2. **Message mode** — temporarily replaces the hint.
   - Warning: `Manual arrangement is temporary. Editing the DSL or choosing Auto arrange will reset it. Export the .cell file to preserve it.`
   - DSL reset information: `Manual layout reset after DSL change.`
   - Auto arrange information: `Components returned to automatic layout.`

### Warning triggers

- When custom-layout mode changes from inactive to active after the first
  successful component or external drag, show the warning for five seconds.
- While custom-layout mode remains active, each distinct focus entry into the
  DSL editor shows the warning for five seconds.
- Moving additional nodes does not retrigger the warning unless a new
  custom-layout session begins after a reset.
- Focusing the DSL editor when no custom layout exists does nothing.

### Information triggers

- A DSL edit that clears a custom layout shows the reset information message.
- Selecting **Auto arrange** shows the Auto arrange information message.
- Information messages remain visible for three seconds.

### Priority and replacement

There is only one active message. A newly triggered message immediately replaces
the current one and restarts its timer. While a message is active, it takes
priority over both resting focus hints. When its timer expires, the slot derives
and displays the current hint, including any focus-view state that changed while
the message was visible.

## Architecture

`App` owns transient canvas-message state because it already owns custom-layout
lifecycle and knows when DSL focus, DSL reset, and Auto arrange events occur.

Conceptually:

```ts
interface CanvasMessage {
  tone: "warning" | "info";
  text: string;
  durationMs: number;
}
```

`App` exposes one `showCanvasMessage(message)` helper. The helper replaces the
current message, clears the previous timer, and schedules expiry. Timer cleanup
runs when the message changes and when `App` unmounts.

`SourceEditor` adds an `onFocus` callback, surfaced through `EditorPanel`, so
`App` can show the warning when focus enters the editor. The callback uses focus
entry rather than individual CodeMirror clicks or cursor movements.

`DiagramCanvas` receives the active message and renders exactly one
bottom-center slot. If a message exists it renders the message text and tone;
otherwise it renders the current focus hint. The existing persistent
`.layout-warning` and separate `.layout-reset-notice` elements are removed.

## Presentation

- Keep the current bottom-center pill position.
- Warning tone uses the existing yellow warning palette.
- Information and resting hints use neutral slate/white styling.
- A newly displayed message uses a short fade-and-scale pop-up animation.
- The animation must respect `prefers-reduced-motion` by disabling movement.
- The slot remains non-interactive and does not block diagram pointer events.
- Width is capped and responsive so the longer warning can wrap on smaller
  screens.

## Testing

- The resting slot shows the normal focus hint.
- Focus view changes the resting hint.
- Activating custom layout shows the warning once for the new layout session.
- Additional drags do not retrigger it.
- Focusing the DSL editor with an active custom layout shows the warning again.
- Focusing the editor without custom layout does not show it.
- DSL reset and Auto arrange show their information messages.
- A new message replaces an older message and resets expiry timing.
- After timer expiry, the current resting hint returns.
- Only one bottom-center slot exists; the old top warning and reset notice do not
  render.
- Warning, information, responsive wrapping, animation, and reduced-motion
  styles have focused coverage.
