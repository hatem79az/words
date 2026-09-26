# Interaction and visual decisions

The supplied visual work paper was evaluated against the offline `file://` app. The implementation stays self-contained: no runtime fetch, third-party script, hosted font, or remote audio file is required.

## Implemented

- Gameplay buttons, option cards, memory cards, and tiles have a consistent small lift, spring transform easing, and restrained offset depth. The editor's form surfaces retain their existing treatment.
- Both tile assembly games have static, high-contrast drag targets and insertion markers. Their shared behavior is documented in [DRAG_AND_DROP_PLAN.md](DRAG_AND_DROP_PLAN.md).
- The welcome panel has CSS letter cards and slow ambient movement. The illustration is decorative, hidden from assistive technology, and removed on narrow viewports where it would crowd the copy.
- `finishChallenge()` presents the complete text result immediately, adds a decorative trophy and score count-up, and plays a brief canvas confetti burst. The canvas is generated locally, never accepts pointer events, and is removed after the animation.
- Three small, original MP3 files play correct, wrong, and completion cues. `js/effects.js` keeps the existing Web Audio oscillator as a fallback if a sample fails; mute pauses active samples and suspends the fallback context. The sample source is reproducible from `tools/generate_feedback_audio.py`.
- A local subset of Baloo 2 at weight 700 styles headings and brand text. It contains Polish and German glyphs, while Arabic falls back to the system font. The full license and attribution are included in the repository.
- The sound toggle uses an inline SVG icon and retains its visible translated label. The welcome letter art and original empty-library SVG are decorative; the empty-state image uses `alt=""`.
- `prefers-reduced-motion` suppresses the canvas burst, score animation, and CSS movement. The result text, final score, tile insertion cue, and controls remain visible.
- Progress history uses the activity selector's localized names for the five stored mode IDs with different string keys.

## Remaining browser quality pass

Review the actual Windows offline launch, local asset loading, narrow and RTL layouts, four interface languages, keyboard focus, mute control, and reduced motion. Check the heading font's Polish/German marks and Arabic fallback. The full pass is tracked in [NEXT_JOB.md](../NEXT_JOB.md).

The original work paper proposed a vendored confetti library and downloaded illustrations. We kept the existing small canvas implementation and drew the vector decorations locally, avoiding a runtime library. All bundled assets load through `src` or CSS URL. Photographic lesson pictures still convert to WebP; the small crisp decorations remain SVG.
