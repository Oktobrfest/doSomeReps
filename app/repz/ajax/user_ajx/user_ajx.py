from flask import flash, jsonify, request
from flask_login import login_required
from flask import g

from ...bluehelpers import get_user
from ...database import session
from repz.routes import user_ajx


def _update_relation(relation, add, target_user_id, msg, before_commit=None):
    """
    Add or remove another user on one of the current user's relations.

    Every one of these endpoints is the same edit: load both users, move one
    onto or off a collection, commit, and answer 'ok'. `before_commit` is for
    the one endpoint that has a second edit to make in the same transaction.
    """
    usr = get_user(g._login_user.id)
    target = get_user(target_user_id)

    collection = getattr(usr, relation)
    if add:
        collection.append(target)
    else:
        collection.remove(target)

    if before_commit is not None:
        before_commit(usr, target)

    session.commit()
    flash(msg, category="success")

    # Why jsonify: callers parse this with response.json(). Returning the bare
    # string made every successful call look like a client-side failure.
    return jsonify('ok')


@user_ajx.route("/fav_user", methods=["POST"], endpoint="fav_user")
@login_required
def fav_user():
    # Sent as text/plain, so it arrives as a raw body rather than JSON or a form.
    return _update_relation(
        "favorates", True, request.data.decode("utf-8"),
        "Question creator added to your favorites list",
    )


@user_ajx.route("/unfavorite_user", methods=["POST"], endpoint="unfavorite_user")
@login_required
def unfavorite_user():
    return _update_relation(
        "favorates", False, request.get_json()['user_id'], "Unfavorited User",
    )


@user_ajx.route("/block_user", methods=["POST"], endpoint="block_user")
@login_required
def block_user():
    def drop_from_favorites(usr, blocked_user):
        """Blocking supersedes favouriting: you cannot hold both on one user."""
        if blocked_user in usr.favorates:
            usr.favorates.remove(blocked_user)

    return _update_relation(
        "blocked_users", True, request.form.get("block_user_id"), "Blocked User",
        before_commit=drop_from_favorites,
    )


@user_ajx.route("/unblock_user", methods=["POST"], endpoint="unblock_user")
@login_required
def unblock_user():
    return _update_relation(
        "blocked_users", False, request.form.get("blk_user_id"), "Unblocked User",
    )
