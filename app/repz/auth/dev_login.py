"""
Dev-only login bypass.

This blueprint is ONLY registered when FLASK_ENV=development (see
repz/__init__.py). It lets you skip Authentik/OIDC entirely and log in as any
user that already exists in your local database.

DO NOT register this in production. The gate in __init__.py is the only thing
keeping it from showing up there.
"""

from datetime import datetime

from flask import (
    Blueprint,
    abort,
    current_app,
    flash,
    redirect,
    render_template_string,
    url_for,
)
from flask_login import login_user, logout_user
from sqlalchemy import select

from ..database import session as dbsession
from ..models import users as Users

dev_auth = Blueprint(
    "dev_auth",
    __name__,
    url_prefix="",
)


_PAGE = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>DEV LOGIN — pick a user</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    h1 { color: #b00; }
    .banner { background: #ffeaea; border: 2px dashed #b00; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f8f8f8; }
    .btn { display: inline-block; padding: 0.35rem 0.75rem; background: #2a7ae2; color: #fff; text-decoration: none; border-radius: 4px; font-size: 0.9rem; }
    .btn:hover { background: #1a5fc4; }
    .role-admin { color: #b00; font-weight: bold; }
    .role-user { color: #555; }
    .empty { padding: 2rem; text-align: center; color: #888; }
    code { background: #f0f0f0; padding: 0.1rem 0.3rem; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="banner">
    <strong>⚠️ DEV LOGIN</strong> — this page only exists when
    <code>FLASK_ENV=development</code>. Pick any user below to skip the OIDC
    flow and log in as them.
  </div>
  <h1>Local users ({{ users|length }})</h1>
  {% if users %}
    <table>
      <thead>
        <tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th></th></tr>
      </thead>
      <tbody>
      {% for u in users %}
        <tr>
          <td>{{ u.id }}</td>
          <td>{{ u.username }}</td>
          <td>{{ u.email }}</td>
          <td class="role-{{ 'admin' if u.role == 2 else 'user' }}">
            {{ 'admin' if u.role == 2 else 'user' }}
          </td>
          <td>
            <a class="btn" href="{{ url_for('dev_auth.dev_login_as', user_id=u.id) }}">
              Login as this user
            </a>
          </td>
        </tr>
      {% endfor %}
      </tbody>
    </table>
  {% else %}
    <div class="empty">
      No users in the database yet. Load your dump first, then refresh.
    </div>
  {% endif %}
  <p style="margin-top:2rem;">
    <a href="{{ url_for('auth.logout') }}">Logout</a>
    &nbsp;|&nbsp;
    <a href="{{ url_for('home.homepage') }}">Home</a>
  </p>
</body>
</html>
"""


@dev_auth.route("/dev-login")
def dev_login_index():
    """Show a clickable list of all users so you can log in as any of them."""
    rows = (
        dbsession.execute(select(Users).order_by(Users.role.desc(), Users.id.asc()))
        .scalars()
        .all()
    )
    return render_template_string(_PAGE, users=rows)


@dev_auth.route("/dev-login/<int:user_id>")
def dev_login_as(user_id):
    """Log in as the user with the given id, no password required."""
    user_obj = dbsession.execute(
        select(Users).where(Users.id == user_id)
    ).scalar_one_or_none()

    if user_obj is None:
        abort(404, description=f"No user with id={user_id}")

    # Mirror what the real OIDC callback does on login.
    user_obj.last_login = datetime.utcnow()
    dbsession.commit()

    login_user(user_obj)
    current_app.logger.warning(
        "[DEV-LOGIN] Logged in as id=%s username=%s role=%s",
        user_obj.id,
        user_obj.username,
        user_obj.role,
    )
    flash(f"DEV: logged in as {user_obj.username}", category="success")
    return redirect(url_for("home.homepage"))


@dev_auth.route("/dev-logout")
def dev_logout():
    """Convenience logout that doesn't touch any OIDC end-session endpoints."""
    logout_user()
    flash("DEV: logged out.", category="success")
    return redirect(url_for("dev_auth.dev_login_index"))
