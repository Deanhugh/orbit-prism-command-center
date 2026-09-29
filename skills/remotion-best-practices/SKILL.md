---
name: remotion-best-practices
description: Plan programmatic videos the Remotion way — compositions, frame-driven motion, sequences, and a later render
agents: [mk_gfx, mk_lead, mk_social, jarvis, chief]
department: marketing
---
# Remotion Best Practices

Playbook from [remotion-dev/remotion](https://github.com/remotion-dev/remotion) Agent Skills (`remotion-best-practices`). Use for programmatic films, motion graphics, and captioned spots.

In this office you do not run `npx remotion`, FFmpeg, or install the Remotion monorepo. Write the composition brief and timed shot list. Do not claim a rendered MP4.

## How a Remotion video is built

1. One composition — width, height, fps, duration in frames. Default 1920×1080 at 30 fps unless the platform needs 9:16 or 1:1.
2. Drive motion from the current frame. Name each layer. Fade, scale, move, and rotate on a timeline. Do not rely on CSS transitions or Tailwind animate classes — those do not encode.
3. Sequence scenes. Give each shot a start frame and a duration. Trim media instead of stretching it. Mute plate audio unless it is the approved track.
4. Put titles, lower thirds, and captions on after picture lock. Keep type large and on-safe. One typeface family.
5. Note assets as public files (logo, voice, B-roll) with start, duration, and volume.

## When to use this vs Lanshu

- Remotion — motion graphics, product films, explainers, captioned social cuts, multi-scene spots.
- Lanshu (`lanshu-create-ai-presenter-video`) — talking-head / presenter from a script and an authorized portrait.

## Deliverable

Composition spec (size, fps, frames), scene list with start/duration, layer names, caption text, and asset list. Say what a later Remotion render still needs (`npx remotion render`, stills for QA). Remotion itself is source-available with a company license for larger for-profit teams.
