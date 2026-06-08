from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import select, delete
from repz.database import session
from repz.models import category_lists, category
from repz.bluehelpers import remove_underscore

# JSON-based endpoints for Category Lists CRUD
catz_api = Blueprint('catz_api', __name__)

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

    data = []
    for cl in user_lists:
        data.append({
            'id': cl.id,
            'name': cl.category_list_name,
            'is_default': bool(cl.is_default),
            'categories': [c.category_name for c in cl.categories]
        })
    return jsonify(data)

@catz_api.route('/api/category-lists', methods=['POST'])
@login_required
def create_category_list():
    req_data = request.get_json() or {}
    name = req_data.get('name', '').strip()
    selected_slugs = req_data.get('categories', []) # These are slugs/names
    is_default = bool(req_data.get('is_default', False))

    if not name:
        return jsonify({'error': 'Name is required'}), 400

    # Map slugs back to actual category names if needed, or if slugs are already clean.
    # We replace underscore with spaces or keep them. Let's make sure we find actual database categories.
    db_categories = session.execute(select(category)).scalars().all()
    # slugs mapping
    slug_map = {c.category_name.replace(" ", "_"): c for c in db_categories}

    # Find which categories were selected
    chosen_cats = []
    for slug in selected_slugs:
        # Check matching slug or direct name
        cat_obj = slug_map.get(slug)
        if not cat_obj:
            # Try to match by direct name or remove_underscore
            direct_name = remove_underscore(slug)
            cat_obj = next((c for c in db_categories if c.category_name == direct_name or c.category_name == slug), None)
        if cat_obj:
            chosen_cats.append(cat_obj)

    # If is_default is true, unset default for other lists of the user
    if is_default:
        session.query(category_lists).filter_by(user_id=current_user.id).update({category_lists.is_default: False})

    new_list = category_lists(
        user_id=current_user.id,
        category_list_name=name,
        is_default=is_default
    )
    new_list.categories = chosen_cats

    session.add(new_list)
    session.commit()

    return jsonify({
        'id': new_list.id,
        'name': new_list.category_list_name,
        'is_default': bool(new_list.is_default),
        'categories': [c.category_name for c in new_list.categories]
    }), 201

@catz_api.route('/api/category-lists/<int:list_id>', methods=['DELETE'])
@login_required
def delete_category_list(list_id):
    cl = session.get(category_lists, list_id)
    if not cl or cl.user_id != current_user.id:
        return jsonify({'error': 'List not found'}), 404

    session.delete(cl)
    session.commit()
    return jsonify({'success': True})

@catz_api.route('/api/category-lists/<int:list_id>/set-default', methods=['POST'])
@login_required
def set_default_list(list_id):
    cl = session.get(category_lists, list_id)
    if not cl or cl.user_id != current_user.id:
        return jsonify({'error': 'List not found'}), 404

    session.query(category_lists).filter_by(user_id=current_user.id).update({category_lists.is_default: False})
    cl.is_default = True
    session.commit()

    return jsonify({'success': True})
