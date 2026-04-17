import json
import os
import re
from datetime import datetime, timedelta
import urllib.error
import urllib.request

from flask import Blueprint, jsonify, request
from flask_login import current_user
from app import db
from app.models import History, Sign, build_animation_sequence

api_bp = Blueprint('api', __name__)

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

    gemini_api_key = os.getenv('GEMINI_API_KEY')
    if not gemini_api_key:
        return jsonify({'error': 'GEMINI_API_KEY topilmadi.'}), 500

    mime_type = 'image/jpeg'
    base64_data = image_data

    match = re.match(r'^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$', image_data)
    if match:
        mime_type = match.group(1)
        base64_data = match.group(2)

    gemini_url = (
        'https://generativelanguage.googleapis.com/v1beta/models/'
        'gemini-1.5-pro:generateContent'
    )

    gemini_payload = {
        'contents': [
            {
                'parts': [
                    {
                        'text': (
                            "Siz imo-ishora tilini tahlil qiluvchi yordamchisiz. "
                            "Rasmda ko'rsatilgan asosiy imo-ishorani aniqlang va "
                            "faqat bitta qisqa javob qaytaring. "
                            "Masalan: Salom, Rahmat, Yordam. "
                            "Agar aniq bo'lmasa, faqat: Aniqlanmadi deb yozing."
                        )
                    },
                    {
                        'inline_data': {
                            'mime_type': mime_type,
                            'data': base64_data
                        }
                    }
                ]
            }
        ],
        'generationConfig': {
            'temperature': 0.2,
            'maxOutputTokens': 20
        }
    }

    req = urllib.request.Request(
        gemini_url,
        data=json.dumps(gemini_payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'x-goog-api-key': gemini_api_key,
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            gemini_result = json.loads(resp.read().decode('utf-8'))

        recognized_text = 'Aniqlanmadi'
        candidates = gemini_result.get('candidates', [])

        if candidates:
            parts = candidates[0].get('content', {}).get('parts', [])
            if parts and parts[0].get('text'):
                recognized_text = parts[0]['text'].strip()

        recognized_text = recognized_text.strip().strip('"').strip("'") or 'Aniqlanmadi'

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

    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='ignore')
        return jsonify({
            'error': 'Gemini API xatosi.',
            'details': error_body
        }), e.code

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
