"""User profile page - lets a logged-in user save their AI provider
credentials (used by LiteLLM)."""

from flask import flash, redirect, render_template, url_for
from flask_login import current_user, login_required
from sqlalchemy import select

from repz.routes import ai

from ..database import session
from ..models import users
from .profile_forms import AIProfileForm


def _resolve_provider(form: AIProfileForm) -> str:
    """If the user picked 'custom' in the dropdown, use the free-text
    field; otherwise use the dropdown value. Empty string means 'unset'."""
    provider = (form.ai_provider.data or "").strip()
    if provider == "custom":
        provider = (form.ai_provider_custom.data or "").strip()
    return provider


@ai.route("/profile", methods=["GET", "POST"], endpoint="profile")
@login_required
def profile():
    """Render and save the per-user AI integration form."""
    user_obj = session.execute(
        select(users).where(users.id == current_user.id)
    ).scalar_one()

    form = AIProfileForm()

    if form.validate_on_submit():
        user_obj.ai_provider = _resolve_provider(form) or None
        user_obj.ai_model = (form.ai_model.data or "").strip() or None
        # Only overwrite the stored API key if the user actually typed
        # something - empty submission means "leave existing key alone".
        if form.ai_api_key.data:
            user_obj.ai_api_key = form.ai_api_key.data.strip() or None
        user_obj.ai_api_base = (form.ai_api_base.data or "").strip() or None

        session.commit()
        flash("AI settings saved.", category="success")
        return redirect(url_for("ai.profile"))

    # GET (or failed validation): pre-populate from DB. For the
    # provider dropdown we show 'custom' if the stored value isn't one
    # of our common choices, so the user can see/edit it.
    if user_obj.ai_provider:
        known = {choice[0] for choice in (form.ai_provider.choices or [])}
        if user_obj.ai_provider in known:
            form.ai_provider.data = user_obj.ai_provider
        else:
            form.ai_provider.data = "custom"
            form.ai_provider_custom.data = user_obj.ai_provider
    form.ai_model.data = user_obj.ai_model or ""
    form.ai_api_base.data = user_obj.ai_api_base or ""
    # NB: never echo the API key back into the form.

    return render_template(
        "profile.html",
        title="Profile",
        description="Configure your AI provider integration.",
        user=current_user,
        form=form,
        has_saved_key=bool(user_obj.ai_api_key),
    )
