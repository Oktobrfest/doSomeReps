import hashlib
from repz import cache

class CacheHelper:
    def __init__(self, user_id):
        self.user_id = user_id

    def generate_cache_key(self, categories):
        sorted_cats = sorted(categories)
        cats_string = ''.join(sorted_cats)
        cat_hash = hashlib.md5(cats_string.encode()).hexdigest()
        return f"que_user_{self.user_id}_cats_{cat_hash}"

    def get_cached_questions(self, categories):
        key = self.generate_cache_key(categories)
        que_list = cache.get(key) or []
        return que_list, key


   # implement caching
# def cache_cats(selected_categories, UID):
#     sorted_cats = sorted(selected_categories) 
#     cats_string = ''.join(sorted_cats)
#     cat_hash = hashlib.md5(cats_string.encode()).hexdigest() 
#     que_cache_key = f"que_user_{UID}_cats_{cat_hash}"
#     que_list = cache.get(que_cache_key) or []
#     return que_list