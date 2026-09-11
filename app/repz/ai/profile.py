"""User profile page - lets a logged-in user save their AI provider
credentials (used by LiteLLM)."""

from flask import flash, redirect, render_template, url_for, request
from flask_login import current_user, login_required
from sqlalchemy import select

from repz.routes import ai

from ..database import session
from ..models import users, languages
from .profile_forms import ProfileLanguagesForm, MAX_LANGUAGES


@ai.route("/profile", methods=["GET", "POST"], endpoint="profile")
@login_required
def profile():
    """Render and save the per-user profile languages form."""
    user_obj = session.execute(
        select(users).where(users.id == current_user.id)
    ).scalar_one()

    form = ProfileLanguagesForm()

    # Populate choices dynamically from the DB
    db_languages = session.execute(
        select(languages.language).order_by(languages.language)
    ).scalars().all()
    form.languages.choices = [(lang, lang) for lang in db_languages]

    if form.validate_on_submit():
        # Update language selections
        selected_langs = form.languages.data or []
        db_langs = session.execute(
            select(languages).where(languages.language.in_(selected_langs))
        ).scalars().all()
        user_obj.languages = list(db_langs)

        session.commit()
        flash("Language settings saved.", category="success")
        return redirect(url_for("ai.profile"))

    # Populate current settings for display
    if request.method == "GET":
        form.languages.data = [lang_obj.language for lang_obj in user_obj.languages]

    return render_template(
        "profile.html",
        title="Profile",
        description="Configure your AI provider integration.",
        user=current_user,
        languages=[value for value, _label in form.languages.choices],
        selected_languages=form.languages.data or [],
        max_languages=MAX_LANGUAGES,
        errors=[
            f"{field}: {message}"
            for field, messages in form.errors.items()
            for message in messages
        ],
    )
