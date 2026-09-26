# Interaction and visual decisions

The supplied visual work paper was evaluated against the offline `file://` app. The implementation stays self-contained: no runtime fetch, third-party script, hosted font, or external audio file is required.

## Implemented

- Gameplay buttons, option cards, memory cards, and tiles have a consistent small lift, spring transform easing, and restrained offset depth. The editor's form surfaces retain their existing treatment.
- Both tile assembly games have static, high-contrast drag targets and insertion markers. Their shared behavior is documented in [DRAG_AND_DROP_PLAN.md](DRAG_AND_DROP_PLAN.md).
- The welcome panel has CSS letter cards and slow ambient movement. The illustration is decorative, hidden from assistive technology, and removed on narrow viewports where it would crowd the copy.
- `finishChallenge()` keeps the text result and synthesized completion cue, and adds a brief canvas confetti burst. The canvas is generated locally, never accepts pointer events, and is removed after the animation.
- `prefers-reduced-motion` suppresses the canvas burst and CSS movement. The result text, scores, tile insertion cue, and controls remain visible.
- Progress history uses the activity selector's localized names for the five stored mode IDs with different string keys.

## Remaining browser quality pass

Review the actual Windows offline launch, narrow and RTL layouts, four interface languages, keyboard focus, mute control, and reduced motion. The full pass is tracked in [NEXT_JOB.md](../NEXT_JOB.md).

The work paper also proposed sample sound files, a self-hosted display font, and external icons/illustrations. These remain optional until the browser pass demonstrates a concrete improvement. If added, keep them local and load via `src` or CSS URL (never `fetch()` under `file://`), preserve oscillator fallback and mute behavior, check Arabic/Polish/German glyphs, and record external asset licenses. Use WebP for photographic raster artwork and SVG for small vector decoration.
