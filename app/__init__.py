import os
from datetime import timedelta

from flask import Flask
from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text

from config import Config


db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Iltimos, avval tizimga kiring.'
login_manager.login_message_category = 'warning'
login_manager.session_protection = 'strong'


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _ensure_user_schema():
    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())

    if 'user' not in tables:
        return

    columns = {column['name'] for column in inspector.get_columns('user')}

    with db.engine.begin() as connection:
        if 'username' not in columns:
            connection.execute(text('ALTER TABLE user ADD COLUMN username VARCHAR(80)'))

        if 'password_hash' not in columns:
            connection.execute(text("ALTER TABLE user ADD COLUMN password_hash VARCHAR(255) DEFAULT ''"))

        if 'created_at' not in columns:
            connection.execute(text('ALTER TABLE user ADD COLUMN created_at DATETIME'))

        if 'theme_bg_color' not in columns:
            connection.execute(text('ALTER TABLE user ADD COLUMN theme_bg_color VARCHAR(7)'))

        if 'theme_card_color' not in columns:
            connection.execute(text('ALTER TABLE user ADD COLUMN theme_card_color VARCHAR(7)'))

        if 'theme_button_color' not in columns:
            connection.execute(text('ALTER TABLE user ADD COLUMN theme_button_color VARCHAR(7)'))

        if 'theme_text_color' not in columns:
            connection.execute(text('ALTER TABLE user ADD COLUMN theme_text_color VARCHAR(7)'))

        existing_columns = {column['name'] for column in inspect(db.engine).get_columns('user')}
        seed_column = 'email' if 'email' in existing_columns else 'name' if 'name' in existing_columns else None

        if seed_column == 'email':
            connection.execute(text("""
                UPDATE user
                SET username = lower(
                    CASE
                        WHEN instr(trim(email), '@') > 1 THEN substr(trim(email), 1, instr(trim(email), '@') - 1)
                        WHEN trim(email) <> '' THEN trim(email)
                        ELSE 'user_' || id
                    END
                )
                WHERE username IS NULL OR trim(username) = ''
            """))
        elif seed_column == 'name':
            connection.execute(text("""
                UPDATE user
                SET username = lower(replace(trim(name), ' ', '_'))
                WHERE (username IS NULL OR trim(username) = '')
                  AND name IS NOT NULL
                  AND trim(name) <> ''
            """))

        connection.execute(text("""
            UPDATE user
            SET username = 'user_' || id
            WHERE username IS NULL OR trim(username) = ''
        """))

        connection.execute(text("""
            UPDATE user
            SET created_at = CURRENT_TIMESTAMP
            WHERE created_at IS NULL
        """))

        connection.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS ix_user_username ON user (username)
        """))


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    app.config.setdefault('SESSION_COOKIE_HTTPONLY', True)
    app.config.setdefault('SESSION_COOKIE_SAMESITE', 'Lax')
    app.config.setdefault('SESSION_COOKIE_SECURE', _as_bool(os.getenv('SESSION_COOKIE_SECURE'), False))
    app.config.setdefault('REMEMBER_COOKIE_HTTPONLY', True)
    app.config.setdefault('REMEMBER_COOKIE_SAMESITE', 'Lax')
    app.config.setdefault('REMEMBER_COOKIE_SECURE', app.config['SESSION_COOKIE_SECURE'])
    app.config.setdefault('REMEMBER_COOKIE_DURATION', timedelta(days=14))
    app.config.setdefault('PERMANENT_SESSION_LIFETIME', timedelta(days=7))

    db.init_app(app)
    login_manager.init_app(app)

    from .models import User

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    from .routes.auth import auth_bp
    from .routes.main import main_bp
    from .routes.admin import admin_bp
    from .routes.api import api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(api_bp, url_prefix='/api')

    with app.app_context():
        db.create_all()
        _ensure_user_schema()

    return app
