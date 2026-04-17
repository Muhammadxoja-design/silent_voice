# Silent Voice Demo

Silent Voice is a mobile-first Flask + SQLite demo product for sign-language assistance. It includes:

- Email authentication
- Profile management with language selection
- User dashboard with streak and learning stats
- Demo live camera page with MediaPipe-ready frontend and 12 gesture mappings
- 3D avatar-style sign playback page
- Learning center with categories
- Custom recorder for user-defined sign notes
- Admin panel for users, feedback, signs, and stats
- Offline library page for 100-sign future extension
- Future AI provider hook endpoints for ChatGPT/Grok integration
- Render deployment config
- PWA manifest + service worker

## Quick start

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py
python run.py
```

Open: `http://127.0.0.1:5000`

## Default admin

Create a normal account first, then in Python shell:

```python
from app import create_app, db
from app.models import User
app = create_app()
with app.app_context():
    u = User.query.filter_by(email='your@email.com').first()
    u.is_admin = True
    db.session.commit()
```

## Render deploy

1. Push this project to GitHub.
2. Create a new **Web Service** on Render.
3. Use the included `render.yaml` or set:
   - Build Command: `bash build.sh`
   - Start Command: `gunicorn wsgi:app`
4. Add persistent disk if you want uploads/database persistence.

## Android / iOS build path

This demo ships as a responsive PWA. For store-ready apps, wrap it using Capacitor:

```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init silent-voice com.silentvoice.demo
```

Set `webDir` to a static exported frontend or point WebView to deployed URL.
Then:

```bash
npx cap add android
npx cap add ios
npx cap open android
npx cap open ios
```

Recommended next step: split frontend to React/Next or Expo, keep this Flask app as backend API.
