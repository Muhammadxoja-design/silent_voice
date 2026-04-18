import base64
import binascii
import os
import re
from datetime import datetime, timedelta
from pathlib import Path

from flask import Blueprint, jsonify, request
from flask_login import current_user
from app import db
from app.models import History, Sign, build_animation_sequence

api_bp = Blueprint('api', __name__)

GEMINI_SYSTEM_PROMPT = (
    "You are an expert sign language interpreter. Analyze this frame showing a hand gesture. "
    "Output ONLY the translated meaning in text. Do not add any conversational filler."
)


def _load_gemini_api_key():
    api_key = os.getenv('GEMINI_API_KEY')
    if api_key:
        return api_key

    env_path = Path(__file__).resolve().parents[2] / '.env'
    if not env_path.exists():
        return None

    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        if key.strip() == 'GEMINI_API_KEY':
            api_key = value.strip().strip('"').strip("'")
            if api_key:
                os.environ.setdefault('GEMINI_API_KEY', api_key)
                return api_key

    return None


def _decode_image_payload(image_data):
    mime_type = 'image/jpeg'
    encoded = image_data

    match = re.match(r'^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$', image_data)
    if match:
        mime_type = match.group(1)
        encoded = match.group(2)

    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError('Base64 rasm noto‘g‘ri formatda yuborilgan.') from exc

    return mime_type, image_bytes


def _translate_frame_with_gemini(image_bytes, mime_type):
    api_key = _load_gemini_api_key()
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY .env yoki environment ichida topilmadi.')

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise RuntimeError("`google-genai` paketi o‘rnatilmagan. `pip install google-genai` qiling.") from exc

    client = genai.Client(api_key=api_key)
    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    response = client.models.generate_content(
        model=os.getenv('GEMINI_MODEL', 'gemini-2.5-flash'),
        contents=[
            'Translate the sign in this single frame.',
            image_part,
        ],
        config=types.GenerateContentConfig(
            system_instruction=GEMINI_SYSTEM_PROMPT,
            temperature=0.1,
            max_output_tokens=24,
        ),
    )

    text = (response.text or '').strip().strip('"').strip("'")
    return text or 'Aniqlanmadi'

@api_bp.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'silent-voice-demo'})

@api_bp.route('/signs')
def signs():
    signs = Sign.query.all()
    return jsonify([{
        'id': s.id,
        'title': s.title,
        'category': s.category,
        'meaning': s.meaning,
        'description': s.description,
    } for s in signs])

@api_bp.route('/ai/translate', methods=['POST'])
def ai_translate():
    payload = request.get_json(silent=True) or {}
    text = payload.get('text', '')
    provider = payload.get('provider', 'internal-demo')
    return jsonify({
        'provider': provider,
        'input': text,
        'output': f'Demo response for: {text}',
        'note': 'Replace this endpoint with ChatGPT, Grok, or any future multimodal API integration.'
    })

@api_bp.route('/translate', methods=['POST'])
@api_bp.route('/recognize', methods=['POST'])
def recognize_sign():
    payload = request.get_json(silent=True) or {}

    image_data = (
        payload.get('image')
        or payload.get('frame')
        or payload.get('image_base64')
        or ''
    ).strip()

    if not image_data:
        return jsonify({'error': 'Base64 rasm yuborilmadi.'}), 400

    try:
        mime_type, image_bytes = _decode_image_payload(image_data)
        recognized_text = _translate_frame_with_gemini(image_bytes, mime_type)

        if current_user.is_authenticated and recognized_text and recognized_text != 'Aniqlanmadi':
            latest_entry = History.query.filter_by(user_id=current_user.id).order_by(History.created_at.desc()).first()
            should_save = True

            if latest_entry:
                repeated_text = latest_entry.recognized_text.strip().lower() == recognized_text.lower()
                recent_repeat = latest_entry.created_at >= datetime.utcnow() - timedelta(seconds=15)
                should_save = not (repeated_text and recent_repeat)

            if should_save:
                db.session.add(History(
                    user_id=current_user.id,
                    recognized_text=recognized_text,
                ))
                db.session.commit()

        return jsonify({
            'text': recognized_text
        })

    except Exception as e:
        return jsonify({
            'error': 'Rasmni tahlil qilishda xatolik yuz berdi.',
            'details': str(e)
        }), 500

@api_bp.route('/animate', methods=['POST'])
def animate_text():
    payload = request.get_json(silent=True) or {}
    text = (payload.get('text') or '').strip()

    if not text:
        return jsonify({'error': 'Text yuborilmadi.'}), 400

    sequence = build_animation_sequence(text)

    return jsonify({
        'input': text,
        'count': len(sequence),
        'animations': sequence
    })

@api_bp.route('/sos', methods=['POST'])
def sos():
    payload = request.get_json(silent=True) or {}
    lat = payload.get('lat')
    lng = payload.get('lng')
    return jsonify({
        'status': 'queued',
        'message': 'Demo SOS accepted.',
        'coordinates': {'lat': lat, 'lng': lng}
    })
