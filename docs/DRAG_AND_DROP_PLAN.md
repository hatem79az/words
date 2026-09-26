# Tile drag and drop

Status: implemented in code; Windows offline browser acceptance remains open in [NEXT_JOB.md](../NEXT_JOB.md).

## Interaction

- Letter tiles and Sentence order accept native desktop mouse drags. A tile can move from the tray into any assembly position, be reordered, or be dragged back to the tray. Repeated letters and sentence chunks retain distinct IDs.
- The existing click/touch and keyboard button actions remain available. Dragging is additional; there is no touch drag gesture.
- The shared helper in `js/app.js` uses each tile's rendered rectangle to choose an insertion position on wrapped rows. Overlapping vertical bounds group tiles on the same row even while hover/press transforms shift them slightly. It compares horizontal midpoints in the container's actual LTR or RTL direction, then removes the source before reinserting it. The insertion line and target tint show where the tile will land.
- Disabled tiles and checked rounds cannot start a drag or receive a drop. Checking an answer also clears the tiles' `draggable` property and grab cursor. `dragstart` writes `text/plain` data for native browser interoperability; the drop also requires a drag started in the current activity. Re-rendering moves focus to the tile at its new location.
- Changes to a selection clear provisional spelling feedback, just as click changes do. The game rules and saved lesson format are untouched.

## Acceptance still needed on the intended Windows browser

1. Place a letter in the middle of a partial word, reorder it, move it back to the tray, then finish and check the word.
2. Do the same with a wrapped Arabic Sentence order round, including repeated chunks; confirm stored order follows visual RTL insertion.
3. Confirm locked answers reject drags. Complete both activities by click and keyboard (Tab, Enter, Space) as well as mouse. Check focus and visible drop indicators at desktop and narrow widths.
4. Open `index.html` through `file://` without network access. If Firefox is part of the target setup, confirm its native drag starts and drops.
