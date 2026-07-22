# DSL Guide Navigation and Export Visibility — Design

Date: 2026-07-22

## Overview

Cell Architect's DSL guide currently presents every notation topic as one long,
flat sequence. The guide is difficult to scan, multi-cell syntax is mixed with
the single-cell learning path, and the existing mobile modal can clip its close
control. The canvas also exposes unfinished PNG and SVG export buttons beneath
the top-right application controls.

This change gives the guide a progressive information architecture, adds
responsive contents navigation, fixes its mobile presentation, and temporarily
removes PNG/SVG export from the UI. The working `.cell` export in the Diagrams
menu remains available.

## Goals

- Teach the core single-cell DSL in the order needed to create a first diagram.
- Separate multi-cell syntax into a clearly labeled beta group.
- Make long guide content easy to navigate on desktop and mobile.
- Ensure all mobile guide controls remain visible and usable.
- Hide unfinished PNG/SVG export controls without removing their underlying
  export implementation.
- Track completion of PNG/SVG export as a separate feature issue.

## Non-goals

- No DSL grammar, parser, compiler, or renderer changes.
- No redesign of the Diagrams panel or `.cell` import/export workflow.
- No implementation work on image export reliability or UX.
- No broad redesign of other application overlays or dialogs.

## Guide Information Architecture

The guide uses three progressive groups. The group order and section order are
fixed.

### Core DSL

1. **Initial diagram**
   - Components
   - Boundary declarations
2. **Dependencies**
   - Internal dependencies
   - Boundary dependencies
   - Dependency labels
3. **Gateways**
   - Gateway exposure
   - Direction rules
4. **Metadata**
   - Title
   - Version
5. **Complete single-cell sample**

The Initial diagram section gets a user to a renderable result quickly by
introducing components and boundary declarations together. The complete
single-cell sample consolidates the full core path and has its own Copy action.

### Multi-cell `BETA`

1. **Cell blocks and project title**
2. **Cross-cell links**
3. **Connected and decoupled modes**
4. **Shared externals**
5. **Complete multi-cell sample**

The `BETA` badge appears only beside the Multi-cell group label in the contents
navigation. It does not repeat on every topic or in the content heading. The
complete multi-cell sample has its own Copy action.

### Reference

1. **Aliases**
2. **Comments**

Existing examples remain copyable. Content is reorganized and lightly edited
for continuity, but its DSL meaning does not change.

## Desktop Interaction Design

The existing centered guide dialog remains. Its body becomes a two-column
layout:

- A persistent contents sidebar on the left.
- Independently scrollable guide content on the right.

The sidebar renders the three groups and their section links. The current
section is visually highlighted as the user scrolls. Selecting a link scrolls
the content pane to the corresponding section. The sidebar may scroll
independently if its content exceeds the available height.

## Mobile Interaction Design

At the existing mobile breakpoint, the guide becomes a full-viewport surface
instead of an inset popup. It removes desktop modal margins and corner radius so
the content is not constrained by a nested, cramped frame.

A sticky, safe-area-aware header contains:

- A hamburger button on the left with the accessible name `Open contents`.
- The guide title in the center.
- A close button on the right with the accessible name `Close DSL guide`.

The controls use fixed touch-target columns so the centered title cannot push
the close button outside the viewport. Header padding accounts for mobile safe
areas.

Selecting the hamburger opens a full-screen Contents sheet inside the guide.
The sheet shows the same groups and links as the desktop sidebar, including the
single Multi-cell `BETA` badge. Selecting a section closes the sheet and scrolls
the content to that section. Closing the sheet without selecting returns to the
same reading position. Switching to desktop width clears any open mobile sheet
state.

Code examples retain horizontal overflow where needed. The guide header remains
visible while guide content scrolls.

## Navigation Architecture

Guide content is represented as grouped data with stable section IDs. Both the
desktop sidebar and mobile Contents sheet render from this shared structure so
their labels, order, beta state, and targets cannot drift apart.

Section elements expose their IDs to navigation. Selecting a contents item uses
`scrollIntoView` on the guide's content pane. An intersection observer tracks
visible sections and updates the active navigation item while the user scrolls.
If intersection observation is unavailable, explicit link navigation still
works; the active state simply remains on the last selected section.

The existing clipboard state and fallback copy path remain unchanged.

## Export Visibility

The PNG and SVG controls are no longer rendered in `DiagramCanvas`. Their
underlying export module remains in the repository for later completion. No
disabled controls or placeholder export menu is shown.

The `.cell` export action remains unchanged in each saved diagram's overflow
menu. The `.cell` import workflow also remains unchanged.

A separate GitHub feature issue will cover the future image-export work:

- Final PNG and SVG interaction design and placement.
- Correct export of complete single-cell and multi-cell diagrams.
- Output dimensions, scaling, background, and filename behavior.
- Progress, success, and failure feedback.
- Desktop and mobile placement.
- Browser compatibility and automated coverage.

## Accessibility

- The desktop sidebar and mobile sheet use navigation semantics with an
  accessible label.
- The active link exposes its current state in addition to visual highlighting.
- Hamburger, Close, and Copy controls retain explicit accessible names.
- Mobile touch targets remain at least 44 by 44 CSS pixels.
- Keyboard users can activate every contents link and close either the sheet or
  guide without pointer input.
- Focus moves into the Contents sheet when it opens and returns to the hamburger
  when it closes.

## Error and State Handling

- A failed clipboard write continues to clear the copied state and leaves the
  guide open.
- A missing section target does not close the mobile Contents sheet, allowing
  the user to choose another item.
- Closing and reopening the guide starts at the beginning with the Initial
  diagram section active.
- Removing PNG/SVG controls eliminates image-export errors from the visible UI;
  `.cell` export behavior is unaffected.

## Testing and Verification

Automated component tests will verify:

- The group and section order matches this specification.
- The Multi-cell group has one `BETA` label in contents navigation.
- Both complete samples render and can be copied.
- Desktop section selection scrolls to the correct target and updates the active
  item.
- The mobile hamburger opens the Contents sheet.
- Mobile selection closes the sheet and navigates to the selected section.
- Mobile sheet close and guide close are separate, accessible actions.
- PNG and SVG buttons are absent from the canvas.
- `.cell` export remains present in the Diagrams menu.

Responsive visual verification will cover representative desktop and phone
viewports. On phones, the guide must fill the viewport, header controls must be
fully visible, the Contents sheet must fit without horizontal clipping, and code
examples must scroll without affecting the header.

## Delivery Boundaries

This implementation changes only guide structure/navigation, related responsive
styles and tests, and PNG/SVG control visibility. The GitHub export issue is a
tracking artifact; completing that issue is a later feature.
