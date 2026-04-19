from datetime import date, datetime
import re

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from . import db


SIGN_ANIMATION_LIBRARY = {
    'salom': {
        'path': '/static/animations/salom.glb',
        'display': 'Salom',
        'pose': 'greet_wave',
        'duration_ms': 2100,
        'subtitle': 'Greeting gesture with a friendly wave.',
        'audience_hint': 'People should read this as a hello or welcome gesture.',
        'left_hand_cue': 'Left hand stays supportive near the torso.',
        'right_hand_cue': 'Right hand lifts and waves from the shoulder.',
    },
    'rahmat': {
        'path': '/static/animations/rahmat.glb',
        'display': 'Rahmat',
        'pose': 'thanks_outward',
        'duration_ms': 2200,
        'subtitle': 'Thank-you style hand release from the face outward.',
        'audience_hint': 'This should feel like sending thanks forward.',
        'left_hand_cue': 'Left hand stays calm and grounded.',
        'right_hand_cue': 'Right hand starts near the face and moves outward.',
    },
    'yordam': {
        'path': '/static/animations/yordam.glb',
        'display': 'Yordam',
        'pose': 'help_forward',
        'duration_ms': 2300,
        'subtitle': 'Offer or help gesture with both hands forward.',
        'audience_hint': 'The pose should feel like offering help or support.',
        'left_hand_cue': 'Left hand opens outward toward the viewer.',
        'right_hand_cue': 'Right hand mirrors the helping motion forward.',
    },
    'ha': {
        'path': '/static/animations/ha.glb',
        'display': 'Ha',
        'pose': 'confirm_yes',
        'duration_ms': 1500,
        'subtitle': 'Short confirming gesture.',
        'audience_hint': 'The body language should read as yes or agreement.',
        'left_hand_cue': 'Left hand stays relaxed by the torso.',
        'right_hand_cue': 'Right hand marks the confirmation.',
    },
    'yoq': {
        'path': '/static/animations/yoq.glb',
        'display': "Yo'q",
        'pose': 'refuse_no',
        'duration_ms': 1700,
        'subtitle': 'Negative response with a firmer body cue.',
        'audience_hint': 'The head and torso should clearly read as a no.',
        'left_hand_cue': 'Left hand closes inward defensively.',
        'right_hand_cue': 'Right hand reinforces the refusal.',
    },
    'men': {
        'path': '/static/animations/men.glb',
        'display': 'Men',
        'pose': 'self_reference',
        'duration_ms': 1700,
        'subtitle': 'Self-reference gesture.',
        'audience_hint': 'The sign points back to the signer.',
        'left_hand_cue': 'Left hand anchors the body.',
        'right_hand_cue': 'Right hand comes back toward the chest.',
    },
    'sen': {
        'path': '/static/animations/sen.glb',
        'display': 'Sen',
        'pose': 'point_you',
        'duration_ms': 1800,
        'subtitle': 'Direct address toward the viewer.',
        'audience_hint': 'The sign points outward to another person.',
        'left_hand_cue': 'Left hand remains neutral.',
        'right_hand_cue': 'Right hand points toward the audience.',
    },
    'siz': {
        'path': '/static/animations/siz.glb',
        'display': 'Siz',
        'pose': 'point_respect',
        'duration_ms': 1850,
        'subtitle': 'Respectful outward address.',
        'audience_hint': 'This is a polite direct reference to someone else.',
        'left_hand_cue': 'Left hand supports the pose.',
        'right_hand_cue': 'Right hand extends outward with more control.',
    },
    'biz': {
        'path': '/static/animations/biz.glb',
        'display': 'Biz',
        'pose': 'group_include',
        'duration_ms': 2000,
        'subtitle': 'Inclusive group gesture.',
        'audience_hint': 'The movement gathers people together into one group.',
        'left_hand_cue': 'Left hand opens inward to include the group.',
        'right_hand_cue': 'Right hand mirrors the inclusive sweep.',
    },
    'bugun': {
        'path': '/static/animations/bugun.glb',
        'display': 'Bugun',
        'pose': 'today_mark',
        'duration_ms': 1900,
        'subtitle': 'Present-time emphasis.',
        'audience_hint': 'The hands focus attention on the present moment.',
        'left_hand_cue': 'Left hand frames the center space.',
        'right_hand_cue': 'Right hand marks today in front of the body.',
    },
    'xayr': {
        'path': '/static/animations/xayr.glb',
        'display': 'Xayr',
        'pose': 'goodbye_wave',
        'duration_ms': 2100,
        'subtitle': 'Farewell wave.',
        'audience_hint': 'People should feel that the avatar is saying goodbye.',
        'left_hand_cue': 'Left hand stays open and balanced.',
        'right_hand_cue': 'Right hand waves goodbye.',
    },
}

LETTER_POSE_MAP = {
    'a': 'letter_a',
    'e': 'letter_e',
    'i': 'letter_i',
    'l': 'letter_l',
    'o': 'letter_o',
    'r': 'letter_r',
    's': 'letter_s',
    't': 'letter_t',
}


def normalize_text_tokens(text):
    return re.findall(r"[0-9A-Za-zА-Яа-яЁёҚқҒғҲҳЎўʻʼ’'`-]+", (text or '').lower())


def build_word_animation(word):
    item = SIGN_ANIMATION_LIBRARY[word]
    return {
        'token': word,
        'display': item['display'],
        'type': 'word',
        'path': item['path'],
        'pose': item['pose'],
        'duration_ms': item['duration_ms'],
        'subtitle': item['subtitle'],
        'audience_hint': item['audience_hint'],
        'left_hand_cue': item['left_hand_cue'],
        'right_hand_cue': item['right_hand_cue'],
    }


def build_letter_animation(char):
    upper_char = char.upper()
    pose = LETTER_POSE_MAP.get(char, 'letter_generic')
    return {
        'token': char,
        'display': upper_char,
        'type': 'letter',
        'path': f'/static/animations/letters/{char}.glb',
        'pose': pose,
        'duration_ms': 1100,
        'subtitle': f'Letter {upper_char} finger-spelling pose.',
        'audience_hint': 'This is a finger-spelled letter rather than a full word.',
        'left_hand_cue': 'Left hand frames the body and stabilizes the sign.',
        'right_hand_cue': f'Right hand shapes the letter {upper_char}.',
    }


def build_animation_sequence(text):
    words = normalize_text_tokens(text)
    sequence = []

    for word in words:
        if word in SIGN_ANIMATION_LIBRARY:
            sequence.append(build_word_animation(word))
            continue

        for char in word:
            if char.isalnum():
                sequence.append(build_letter_animation(char))

    return sequence


def slugify_username(value):
    normalized = re.sub(r'[^a-z0-9_.]+', '_', (value or '').strip().lower())
    normalized = normalized.strip('._')
    return normalized[:80]


class User(UserMixin, db.Model):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, index=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    name = db.Column(db.String(120))
    email = db.Column(db.String(120), unique=True, index=True)
    avatar = db.Column(db.String(255), default='default-avatar.svg')
    language = db.Column(db.String(10), default='UZB')
    theme_bg_color = db.Column(db.String(7))
    theme_card_color = db.Column(db.String(7))
    theme_button_color = db.Column(db.String(7))
    theme_text_color = db.Column(db.String(7))
    sign_count = db.Column(db.Integer, default=0)
    streak_days = db.Column(db.Integer, default=1)
    minutes_spent = db.Column(db.Integer, default=0)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    is_blocked = db.Column(db.Boolean, default=False, nullable=False)
    last_seen_date = db.Column(db.Date, default=date.today)

    recordings = db.relationship('CustomRecording', backref='user', lazy=True, cascade='all, delete-orphan')
    feedback_entries = db.relationship('Feedback', backref='user', lazy=True, cascade='all, delete-orphan')
    history_entries = db.relationship('History', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        password = (password or '').strip()
        if len(password) < 8:
            raise ValueError("Password kamida 8 ta belgidan iborat bo'lishi kerak.")
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def ensure_username(self):
        if self.username:
            return self.username

        seed = self.email or self.name or f'user_{self.id or ""}'
        self.username = slugify_username(seed) or f'user_{self.id or "new"}'
        return self.username


class Sign(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    meaning = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(255))
    video_url = db.Column(db.String(255))
    is_offline = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class CustomRecording(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    label = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    ai_memory_key = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)


class Feedback(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(30), default='new')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)


class History(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    recognized_text = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
