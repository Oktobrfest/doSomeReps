from datetime import datetime

from flask import Blueprint, redirect, url_for, session, current_app, request, abort, flash
from flask_login import login_user, logout_user
from authlib.integrations.flask_client import OAuth
from urllib.parse import urljoin

from ..database import session as dbsession, select
from ..models import users as Users
from ..configs.oidc import OIDCConfig

auth = Blueprint(
    'auth', __name__,
    template_folder='templates',
    static_folder='static',
    url_prefix="",
)
oauth = OAuth()

def _init_oidc(app):
    issuer = OIDCConfig.OIDC_ISSUER.rstrip("/")
    oauth.register(
        name="authentik",
        client_id=OIDCConfig.OIDC_CLIENT_ID,
        client_secret=OIDCConfig.OIDC_CLIENT_SECRET,
        server_metadata_url=urljoin(issuer + "/", ".well-known/openid-configuration"),
        client_kwargs={"scope": OIDCConfig.OIDC_SCOPE},
    )

@auth.before_app_first_request
def setup():
    _init_oidc(current_app)

@auth.route("/login")
def login():
    # send user to Authentik
    redirect_uri = OIDCConfig.OIDC_REDIRECT_URI
    return oauth.authentik.authorize_redirect(redirect_uri)

@auth.route("/auth/callback")
def sso_callback():
 # Why: complete the OIDC flow, exchange code for tokens, fetch user info/claims.
    token = oauth.authentik.authorize_access_token()
    if not token:
        abort(401)
    userinfo = oauth.authentik.userinfo()

    email = userinfo.get("email") or ""
    username = userinfo.get("preferred_username") or email or userinfo.get("sub")
    groups = userinfo.get("groups", []) or []

    # Simple role mapping: 1=user, 2=admin
    role = 2 if ("reps-admin" in groups or "sysadmin" in groups) else 1

    # Upsert local user without password (SSO owns auth)
    stmt = select(Users).where(Users.username == username)
    existing = dbsession.execute(stmt).scalar_one_or_none()

    if existing is None:
        new_user = Users(
            username=username,
            email=email,
            created_on=datetime.utcnow(),
            role=role,
            email_verified=True,
        )
        dbsession.add(new_user)
        dbsession.commit()
        user_obj = new_user
    else:
        # Keep local role in sync with Authentik groups
        if getattr(existing, "role", 1) != role:
            existing.role = role
            dbsession.commit()
        user_obj = existing

    login_user(user_obj)
    flash("Logged in via SSO", category="success")
    # Optionally: honor ?next=
    next_url = request.args.get("next") or url_for("home.homepage")
    return redirect(next_url)


@auth.route("/auth/logout")
def logout():
    # End local session
    logout_user()
    # Optionally, hit Authentik end_session_endpoint
    end_session = oauth.authentik.load_server_metadata().get("end_session_endpoint")
    if end_session:
        # best-effort local redirect, without ID token hint for simplicity
        return redirect(end_session)
    return redirect(url_for("auth.login"))
