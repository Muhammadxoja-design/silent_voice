from app import create_app, db
from app.models import Sign

SIGNS = [
    ('Open Palm', 'General', 'Salom / Hello', 'Flat open hand. Often used as a greeting start gesture.'),
    ('Fist', 'General', 'Stop', 'Closed fist demo gesture.'),
    ('Thumbs Up', 'General', 'Ha / Yes', 'Positive confirmation gesture.'),
    ('Thumbs Down', 'General', 'Yo‘q / No', 'Negative confirmation gesture.'),
    ('Peace / V', 'Alphabet', 'V', 'Two-finger sign.'),
    ('Point', 'Shop', 'I want this', 'Index pointing gesture used for selection.'),
    ('L Sign', 'Alphabet', 'L', 'Thumb and index create an L shape.'),
    ('OK', 'General', 'Okay', 'Thumb-index circle.'),
    ('Pinch', 'Medical', 'Pain here', 'Pinch-like demo for emphasis.'),
    ('Call', 'Emergency', 'Call help', 'Thumb + pinky extended.'),
    ('Help', 'Emergency', 'Help me', 'Demo emergency gesture.'),
    ('SOS', 'Emergency', 'SOS', 'Special emergency sequence placeholder.'),
]

app = create_app()
with app.app_context():
    db.create_all()
    for title, category, meaning, description in SIGNS:
        if not Sign.query.filter_by(title=title).first():
            db.session.add(Sign(title=title, category=category, meaning=meaning, description=description, is_offline=True))
    db.session.commit()
    print('Database seeded successfully.')
