# IntrovertHubs — Ready for Dev (Figma plugin)

Lets a designer mark a IntrovertHubs task as "Ready for Dev" from inside Figma, sending
the file, page, frame, and a deep link back to IntrovertHubs.

## Install (development)

1. In Figma desktop: **Plugins → Development → Import plugin from manifest…**
2. Select `figma-plugin/manifest.json`.

## Use

1. In IntrovertHubs, go to **Settings → Figma Plugin → Generate token** and copy it.
2. Open the plugin in Figma, expand **Connection settings**, paste your IntrovertHubs
   URL and the token, and save.
3. Select the frame that represents the design, paste the IntrovertHubs Task ID, and
   click **Mark Ready for Dev**.

The task's Design card in IntrovertHubs updates immediately: 🎨 UI · 🟢 Ready for Dev,
with an **Open Figma** button that deep-links to the exact frame.
