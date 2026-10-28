# Walkthrough video — script (~75 s)

Record at 1440×900 or larger, in Chrome, with the browser chrome hidden (fullscreen with `Cmd+Ctrl+F`).
Screen-record with voice-over, or record silently and add captions. Export as `public/walkthrough.mp4`
(H.264, under ~15 MB). Optionally add `public/walkthrough.vtt` captions with the same lines.

**Before recording:** hard-refresh `/` so the opening headline and the first example are fresh. Make sure
`/api/status` says `"live": true` if you want a real Claude decision in shot 5.

| # | Time | On screen | Say |
|---|------|-----------|-----|
| 1 | 0:00–0:08 | Page loads. The headline fades and the robot starts moving in its test bay. Don't touch anything. | "This is Rollout — a debugger for an AI agent acting in a simulated world. Here, a robot collecting parcels in a test bay." |
| 2 | 0:08–0:18 | Press **Space** to pause. Drag the time arc back to the moment just before the robot enters the striped caution zone. | "Every run is replayable. I can scrub to any moment — here, just before it cuts through the caution zone." |
| 3 | 0:18–0:30 | Press **F** (Split world). The new bay slides out beside the old one and the camera follows it. | "Splitting the world creates a second future from that exact frame. Nothing is overwritten — the original is still there." |
| 4 | 0:30–0:42 | Press **/**, type "Avoid the caution zones", press Enter. Press **Space** to play. The thought bubble streams the robot's reasoning. | "Then I redirect the agent in plain language. It's a Claude call on the server, and you can watch it reason as it acts." |
| 5 | 0:42–0:52 | Press **I** to open the details drawer. Point the cursor at the decision source label and the instruction marker on the time arc. | "Each decision is labeled with where it came from, and each instruction is an event on the timeline that later splits inherit." |
| 6 | 0:52–1:05 | Press **O** for the overview. Click **Evaluate** if the scorecards aren't scored yet. Hover a scorecard. | "In the overview, every world sits at the same moment. A separate model scores each one on progress, efficiency and safety, with its reasons." |
| 7 | 1:05–1:15 | Press **[** / **]** to fly between worlds, then let it rest on the overview. End on the case-study link in the nav. | "Same world, different futures — side by side. The case study covers the design decisions and how it's built. It's a stylized simulator, not a Runway model." |

**Tips**
- Keep the pointer still when you aren't pointing at something; hide it during shots 1 and 3 if you can.
- If a live call is slow, cut the wait in editing rather than re-recording.
- The last line ("not a Runway model") is important — keep it.
