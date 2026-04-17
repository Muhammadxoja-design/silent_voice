from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app import db
from app.models import User, Sign, Feedback

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


def admin_required():
    if not current_user.is_authenticated or not current_user.is_admin:
        flash('Admin access required.', 'danger')
        return False
    return True

@admin_bp.route('/')
@login_required
def dashboard():
    if not admin_required():
        return redirect(url_for('main.dashboard'))
    stats = {
        'users': User.query.count(),
        'active_users': User.query.filter_by(is_blocked=False).count(),
        'signs': Sign.query.count(),
        'feedback': Feedback.query.count(),
    }
    users = User.query.order_by(User.created_at.desc()).all()
    feedback_entries = Feedback.query.order_by(Feedback.created_at.desc()).all()
    signs = Sign.query.order_by(Sign.created_at.desc()).all()
    return render_template('admin/dashboard.html', stats=stats, users=users, feedback_entries=feedback_entries, signs=signs)

@admin_bp.route('/toggle-block/<int:user_id>')
@login_required
def toggle_block(user_id):
    if not admin_required():
        return redirect(url_for('main.dashboard'))
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        flash('You cannot block yourself.', 'warning')
    else:
        user.is_blocked = not user.is_blocked
        db.session.commit()
        flash('User status updated.', 'success')
    return redirect(url_for('admin.dashboard'))

@admin_bp.route('/add-sign', methods=['POST'])
@login_required
def add_sign():
    if not admin_required():
        return redirect(url_for('main.dashboard'))
    title = request.form.get('title', '').strip()
    category = request.form.get('category', '').strip() or 'General'
    meaning = request.form.get('meaning', '').strip()
    description = request.form.get('description', '').strip()
    if title and meaning:
        db.session.add(Sign(title=title, category=category, meaning=meaning, description=description))
        db.session.commit()
        flash('Sign added.', 'success')
    else:
        flash('Title and meaning are required.', 'danger')
    return redirect(url_for('admin.dashboard'))

@admin_bp.route('/feedback/<int:feedback_id>/resolve')
@login_required
def resolve_feedback(feedback_id):
    if not admin_required():
        return redirect(url_for('main.dashboard'))
    item = Feedback.query.get_or_404(feedback_id)
    item.status = 'reviewed'
    db.session.commit()
    flash('Feedback marked as reviewed.', 'success')
    return redirect(url_for('admin.dashboard'))
