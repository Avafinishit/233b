# Doki animation assets

Doki animation frames live here as normal static files, not in `localStorage`.

Suggested generated layout:

```text
assets/doki/generated/<set-name>/
  idle/idle_01.png
  idle/idle_02.png
  pet/pet_01.png
  eat/eat_01.png
  play/play_01.png
  sleep/sleep_01.png
  manifest.json
```

The app loads `assets/doki/generated/manifest.json` first, then falls back to
`assets/doki/manifest.json`. If no frames are present, the CSS Doki remains as
the lightweight fallback.
