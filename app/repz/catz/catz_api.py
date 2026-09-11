from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import select
from repz.database import session
from repz.models import category_lists, category
from repz.bluehelpers import remove_underscore

# JSON-based endpoints for Category Lists CRUD
catz_api = Blueprint('catz_api', __name__)


def _serialize_list(cl):
    """A category list in the shape the picker consumes."""
    return {
        'id': cl.id,
        'name': cl.category_list_name,
        'is_default': bool(cl.is_default),
        'categories': [c.category_name for c in cl.categories],
    }


def _owned_list(list_id):
    """The caller's list, or None - a list they don't own is indistinguishable
    from one that doesn't exist."""
    cl = session.get(category_lists, list_id)
    return cl if cl and cl.user_id == current_user.id else None


def _resolve_categories(selected_slugs):
    """Map the picker's slugs onto category rows, ignoring names we don't know."""
    db_categories = session.execute(select(category)).scalars().all()
    slug_map = {c.category_name.replace(" ", "_"): c for c in db_categories}

    chosen_cats = []
    for slug in selected_slugs:
        cat_obj = slug_map.get(slug)
        if not cat_obj:
            # Fall back to a direct-name match for callers that send names.
            direct_name = remove_underscore(slug)
            cat_obj = next(
                (c for c in db_categories
                 if c.category_name in (direct_name, slug)),
                None,
            )
        if cat_obj:
            chosen_cats.append(cat_obj)

    return chosen_cats


def _clear_default_for_current_user():
    session.query(category_lists).filter_by(user_id=current_user.id).update(
        {category_lists.is_default: False}
    )


@catz_api.route('/api/categories', methods=['GET'])
@login_required
def get_categories():
    db_categories = session.execute(select(category)).scalars().all()
    categories_list = sorted([c.category_name for c in db_categories])
    return jsonify(categories_list)


@catz_api.route('/api/category-lists', methods=['GET'])
@login_required
def get_category_lists():
    user_lists = session.execute(
        select(category_lists)
        .where(category_lists.user_id == current_user.id)
    ).scalars().all()

    return jsonify([_serialize_list(cl) for cl in user_lists])


@catz_api.route('/api/category-lists', methods=['POST'])
@login_required
def create_category_list():
    req_data = request.get_json() or {}
    name = req_data.get('name', '').strip()
    selected_slugs = req_data.get('categories', [])
    is_default = bool(req_data.get('is_default', False))

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    if is_default:
        _clear_default_for_current_user()

    new_list = category_lists(
        user_id=current_user.id,
        category_list_name=name,
        is_default=is_default
    )
    new_list.categories = _resolve_categories(selected_slugs)

    session.add(new_list)
    session.commit()

    return jsonify(_serialize_list(new_list)), 201


@catz_api.route('/api/category-lists/<int:list_id>', methods=['PUT'])
@login_required
def update_category_list(list_id):
    cl = _owned_list(list_id)
    if not cl:
        return jsonify({'error': 'List not found'}), 404

    req_data = request.get_json() or {}
    cl.categories = _resolve_categories(req_data.get('categories', []))
    session.commit()

    return jsonify(_serialize_list(cl))


@catz_api.route('/api/category-lists/<int:list_id>', methods=['DELETE'])
@login_required
def delete_category_list(list_id):
    cl = _owned_list(list_id)
    if not cl:
        return jsonify({'error': 'List not found'}), 404

    session.delete(cl)
    session.commit()
    return jsonify({'success': True})


@catz_api.route('/api/category-lists/<int:list_id>/set-default', methods=['POST'])
@login_required
def set_default_list(list_id):
    cl = _owned_list(list_id)
    if not cl:
        return jsonify({'error': 'List not found'}), 404

    _clear_default_for_current_user()
    cl.is_default = True
    session.commit()

    return jsonify({'success': True})
