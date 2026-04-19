from urllib.parse import urljoin, urlparse

from flask import Blueprint, current_app, flash, redirect, render_template, request, session, url_for
from flask_login import current_user, login_user, logout_user
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app import db
from app.models import User, slugify_username


auth_bp = Blueprint('auth', __name__)


def _safe_redirect_target(target):
    if not target:
        return None

    host_url = urlparse(request.host_url)
    redirect_url = urlparse(urljoin(request.host_url, target))

    if redirect_url.scheme not in {'http', 'https'}:
        return None

    if host_url.netloc != redirect_url.netloc:
        return None

    return target


def _build_unique_username(raw_username, fallback_seed):
    base = slugify_username(raw_username) or slugify_username(fallback_seed) or 'user'
    candidate = base
    suffix = 1

    while User.query.filter_by(username=candidate).first():
        suffix += 1
        candidate = f'{base}_{suffix}'

    return candidate[:80]


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        submitted_username = request.form.get('username', '')
        full_name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        language = request.form.get('language', 'UZB').strip() or 'UZB'

        if not password:
            flash('Parol kiritilishi shart.', 'danger')
            return render_template('auth/register.html')

        if not submitted_username and not full_name and not email:
            flash("Username yoki foydalanuvchi ma'lumotini kiriting.", 'danger')
            return render_template('auth/register.html')

        username = _build_unique_username(
            submitted_username,
            email.split('@', 1)[0] if email else full_name
        )

        existing_filters = [User.username == username]
        if email:
            existing_filters.append(User.email == email)

        existing_user = User.query.filter(or_(*existing_filters)).first()
        if existing_user:
            if email and existing_user.email == email:
                flash("Bunday foydalanuvchi mavjud: bu email allaqachon ro'yxatdan o'tgan.", 'warning')
            else:
                flash("Bunday foydalanuvchi mavjud: username band.", 'warning')
            return render_template('auth/register.html')

        try:
            user = User(
                username=username,
                name=full_name or username,
                email=email or None,
                language=language,
            )
            user.set_password(password)

            db.session.add(user)
            db.session.commit()

            flash("Ro'yxatdan o'tish muvaffaqiyatli tugadi. Endi tizimga kiring.", 'success')
            return redirect(url_for('auth.login'))
        except ValueError as exc:
            db.session.rollback()
            flash(str(exc), 'warning')
        except IntegrityError:
            db.session.rollback()
            flash("Bunday foydalanuvchi mavjud.", 'warning')
        except Exception:
            db.session.rollback()
            current_app.logger.exception('Registration failed')
            flash("Ro'yxatdan o'tishda xatolik yuz berdi.", 'danger')

    return render_template('auth/register.html')


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        identifier = (
            request.form.get('username')
            or request.form.get('email')
            or request.form.get('identifier')
            or ''
        ).strip().lower()
        password = request.form.get('password', '')
        remember = request.form.get('remember') in {'on', 'true', '1', 'yes'}

        if not identifier or not password:
            flash("Email yoki login hamda parolni kiriting.", 'danger')
            return render_template('auth/login.html')

        user = User.query.filter(
            or_(User.username == identifier, User.email == identifier)
        ).first()

        if not user:
            flash("Bunday foydalanuvchi mavjud emas.", 'danger')
            return render_template('auth/login.html')

        if user.is_blocked:
            flash("Hisobingiz bloklangan. Administrator bilan bog'laning.", 'danger')
            return render_template('auth/login.html')

        if not user.check_password(password):
            flash("Parol noto'g'ri.", 'danger')
            return render_template('auth/login.html')

        session.clear()
        session.permanent = True
        login_user(user, remember=remember, fresh=True)

        next_url = _safe_redirect_target(request.args.get('next'))
        flash('Tizimga muvaffaqiyatli kirdingiz.', 'success')
        return redirect(next_url or url_for('main.dashboard'))

    return render_template('auth/login.html')


@auth_bp.route('/logout', methods=['GET', 'POST'])
def logout():
    if current_user.is_authenticated:
        logout_user()

    session.clear()
    flash('Tizimdan chiqdingiz.', 'info')
    return redirect(url_for('auth.login'))
