---
name: lanshu-create-ai-presenter-video
description: Turn a topic or script plus an authorized adult presenter image into a verified presenter-video job
agents: [mk_gfx, mk_lead, mk_social, jarvis, chief]
department: marketing
---
# Lanshu Create AI Presenter Video

Playbook from [cclank/lanshu-create-ai-presenter-video](https://github.com/cclank/lanshu-create-ai-presenter-video) (MIT). Use for talking-head / presenter films.

In this office you do not run FFmpeg, Python, or paid video CLIs. Write the script, beat sheet, and shot list. Do not claim a finished MP4.

## Inputs

Required: a topic or finished script, and one authorized adult presenter image. Confirm image rights and adult status before any remote upload. Never infer a real voice from a face. Use a stock voice unless cloning is explicitly authorized.

## Workflow

The approved narration is the master clock for motion, captions, cuts, and duration.

1. Lock content — hook, 2–4 useful beats, concise close. 45–75 seconds from a topic; keep a supplied script’s natural length. Default 9:16, 1080×1920, 30 fps unless the platform needs another format.
2. Lock audio — one voice identity, full narration, real duration. Note names and numbers for later ASR.
3. Plan visuals — presenter-led, screen-demo, or mixed. One face, wardrobe, light, and camera. Hands low. One small gesture only on the open or close.
4. Compose — captions and keyword callouts only after audio is final. Mute any generated plate audio; keep the approved narration.
5. QA — identity hold, mouth timing, no extra people, no invented logos, no black or frozen frames you did not author.

## Deliverable

Script, beat sheet, duration, aspect, presenter notes, and the shot list timed to the narration. List what a later renderer still needs (voice, lip-sync, master encode, loudness −16 LUFS). Stop after three rejected paid candidates if a provider is ever connected.
