from datetime import date
from flask import Blueprint, current_app, render_template, request, redirect, send_from_directory, url_for, flash
from flask_login import login_required, current_user
from app import db
from app.models import Sign, CustomRecording, Feedback, History

main_bp = Blueprint('main', __name__)


def update_streak(user):
    today = date.today()
    if user.last_seen_date != today:
        diff = (today - user.last_seen_date).days if user.last_seen_date else 1
        if diff == 1:
            user.streak_days += 1
        elif diff > 1:
            user.streak_days = 1
        user.last_seen_date = today
        db.session.commit()

@main_bp.route('/')
def index():
    featured = Sign.query.limit(4).all()
    return render_template('index.html', featured=featured)


@main_bp.route('/manifest.json')
def manifest():
    return send_from_directory(
        current_app.static_folder,
        'manifest.json',
        mimetype='application/manifest+json',
    )


@main_bp.route('/service-worker.js')
def service_worker():
    response = send_from_directory(
        current_app.static_folder,
        'js/sw.js',
        mimetype='application/javascript',
    )
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache'
    return response

@main_bp.route('/dashboard')
@login_required
def dashboard():
    update_streak(current_user)
    recommended = Sign.query.order_by(Sign.id.desc()).first()
    signs = Sign.query.limit(6).all()
    history_entries = History.query.filter_by(user_id=current_user.id).order_by(History.created_at.desc()).all()
    notifications = [
        'Demo version is live on web and prepared for Render.',
        '12 gesture mappings are enabled for the camera demo.',
        'Future API hooks are ready for ChatGPT / Grok integration.'
    ]
    return render_template(
        'dashboard.html',
        recommended=recommended,
        signs=signs,
        notifications=notifications,
        history_entries=history_entries,
    )

@main_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        current_user.name = request.form.get('name', current_user.name)
        current_user.language = request.form.get('language', current_user.language)
        password = request.form.get('password', '').strip()
        if password:
            current_user.set_password(password)
        db.session.commit()
        flash('Profile updated.', 'success')
        return redirect(url_for('main.profile'))
    return render_template('profile.html')

@main_bp.route('/learning-center')
@login_required
def learning_center():
    category = request.args.get('category')
    query = Sign.query
    if category:
        query = query.filter_by(category=category)
    signs = query.order_by(Sign.category, Sign.title).all()
    categories = sorted({s.category for s in Sign.query.all()})
    return render_template('learning_center.html', signs=signs, categories=categories, active_category=category)

@main_bp.route('/live-camera')
@login_required
def live_camera():
    demo_signs = Sign.query.limit(12).all()
    return render_template('live_camera.html', demo_signs=demo_signs)

@main_bp.route('/avatar', methods=['GET', 'POST'])
@login_required
def avatar():
    text_value = ''
    words = []
    if request.method == 'POST':
        text_value = request.form.get('text', '').strip()
        words = [w for w in text_value.split() if w]
    return render_template('avatar.html', text_value=text_value, words=words)

@main_bp.route('/custom-recorder', methods=['GET', 'POST'])
@login_required
def custom_recorder():
    if request.method == 'POST':
        label = request.form.get('label', '').strip()
        description = request.form.get('description', '').strip()
        if label:
            rec = CustomRecording(label=label, description=description, ai_memory_key=label.lower().replace(' ', '_'), user_id=current_user.id)
            db.session.add(rec)
            current_user.sign_count += 1
            db.session.commit()
            flash('Custom sign saved to AI memory placeholder.', 'success')
            return redirect(url_for('main.custom_recorder'))
        flash('Label is required.', 'danger')
    recordings = CustomRecording.query.filter_by(user_id=current_user.id).order_by(CustomRecording.created_at.desc()).all()
    return render_template('custom_recorder.html', recordings=recordings)

@main_bp.route('/offline-mode')
@login_required
def offline_mode():
    offline_signs = Sign.query.filter_by(is_offline=True).all()
    return render_template('offline_mode.html', offline_signs=offline_signs)

@main_bp.route('/feedback', methods=['POST'])
@login_required
def feedback():
    message = request.form.get('message', '').strip()
    if message:
        db.session.add(Feedback(message=message, user_id=current_user.id))
        db.session.commit()
        flash('Feedback submitted.', 'success')
    else:
        flash('Feedback cannot be empty.', 'warning')
    return redirect(url_for('main.dashboard'))
