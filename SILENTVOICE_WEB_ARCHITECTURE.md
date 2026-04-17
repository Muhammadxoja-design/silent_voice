# SilentVoice Architecture Notes

## What is in the provided codebase

The repository in this workspace is a Flask demo, not the original `hukenovs/slovo` ML repository. The core structure is:

- `app/__init__.py`: creates the Flask app, initializes SQLAlchemy and Flask-Login, and registers blueprints.
- `app/models.py`: stores users, signs, custom recordings, and feedback in SQLite.
- `app/routes/main.py`: serves the dashboard, profile, learning center, live camera page, avatar page, and recorder flows.
- `app/routes/api.py`: exposes simple JSON endpoints including `/api/health`, `/api/signs`, `/api/ai/translate`, and `/api/sos`.
- `app/static/js/live_camera.js`: runs the current camera demo on the client.

## How the current gesture pipeline works

The current pipeline is a frontend-only placeholder:

1. `main.live_camera()` loads `live_camera.html` with up to 12 demo `Sign` records from the database.
2. `live_camera.html` includes a webcam `<video>` element and loads MediaPipe scripts, but it does not actually run a landmark classifier.
3. `app/static/js/live_camera.js` requests webcam access with `getUserMedia`.
4. Recognition is simulated by clicking one of the preloaded gesture buttons, which updates the `Recognized` text.
5. Extra actions like speech synthesis, vibration, and GPS SOS are real browser features, but the sign recognition itself is heuristic/demo only.

In short, the existing app has a UI shell for gesture recognition, but no trained inference pipeline yet.

## What was added

A new Next.js app was created in `web/` for faster competition deployment:

- `web/app/page.tsx`: accessible dashboard layout with the live translator and avatar placeholder.
- `web/components/camera-translator.tsx`: `react-webcam` capture flow that samples a short frame burst without freezing the UI.
- `web/app/api/translate/route.ts`: Gemini multimodal route that accepts base64 frames and returns translated text in Uzbek, English, or Russian.

## Deployment approach

1. Keep Flask running only if you still need its auth/content features.
2. Run the new Next.js app from `web/` for the camera translation demo.
3. Add `GEMINI_API_KEY` to `web/.env.local`.
4. Replace the avatar placeholder later with a hosted solution like Ready Player Me rather than building custom WebGL.
