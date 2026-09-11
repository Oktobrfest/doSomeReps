import unittest
import sys
import os

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

class TestCategoriesFullTemplate(unittest.TestCase):
    """categories.html mounts the full picker via the same Vite entrypoint."""

    def _read_template(self, name):
        path = os.path.join(
            os.path.dirname(__file__), '..', 'repz', 'templates', name
        )
        with open(path, 'r') as f:
            return f.read()

    def test_full_mounts_vite_entrypoint(self):
        content = self._read_template('categories.html')
        self.assertIn('react-categories-root', content)
        self.assertIn(
            'vite_asset("src/entrypoints/CategoriesCore.entry.tsx")', content
        )

    def test_full_passes_mode_flags(self):
        content = self._read_template('categories.html')
        self.assertIn('hideSavedLists', content)
        self.assertIn('hideHeader', content)

    def test_full_has_no_cdn_react(self):
        content = self._read_template('categories.html')
        self.assertNotIn('unpkg.com', content)
        self.assertNotIn('document.write', content)

class TestAddcontentIsReact(unittest.TestCase):
    """addcontent.html mounts the whole page in React; the picker moved inside it."""

    def _read_template(self, path_parts):
        path = os.path.join(os.path.dirname(__file__), '..', *path_parts)
        with open(path, 'r') as f:
            return f.read()

    def test_addcontent_mounts_vite_entrypoint(self):
        content = self._read_template(
            ['repz', 'home', 'templates', 'addcontent.html']
        )
        self.assertIn('id="add-content-root"', content)
        self.assertIn('add-content-data', content)
        self.assertIn(
            'vite_asset("src/entrypoints/AddContent.entry.tsx")', content
        )

    def test_addcontent_no_longer_includes_jinja_partials(self):
        """The picker, question form and new-category form are React-owned now."""
        content = self._read_template(
            ['repz', 'home', 'templates', 'addcontent.html']
        )
        self.assertNotIn('categories_core.html', content)
        self.assertNotIn('editquestionform.html', content)
        self.assertNotIn('new_cat.html', content)

    def test_addcontent_passes_csrf_token(self):
        """QuestionForm.validate_on_submit() rejects the post without it."""
        content = self._read_template(
            ['repz', 'home', 'templates', 'addcontent.html']
        )
        self.assertIn('csrfToken', content)


class TestPagesUsingFullCategories(unittest.TestCase):
    """Verify all pages that need full features still include categories.html."""

    def _read_template(self, path_parts):
        path = os.path.join(os.path.dirname(__file__), '..', *path_parts)
        with open(path, 'r') as f:
            return f.read()

    def test_quiz_passes_categories_to_react(self):
        """quiz.html hands the picker its data via bootstrap JSON, not an include."""
        content = self._read_template(
            ['repz', 'home', 'templates', 'quiz.html']
        )
        self.assertIn('id="quiz-root"', content)
        self.assertIn('categoryList', content)
        self.assertIn('selectedCategories', content)
        self.assertIn('vite_asset("src/entrypoints/Quiz.entry.tsx")', content)

    def test_quemore_passes_categories_to_react(self):
        """quemore.html mounts the picker inside QueMorePage, not via an include."""
        content = self._read_template(
            ['repz', 'home', 'templates', 'quemore.html']
        )
        self.assertIn('id="quemore-root"', content)
        self.assertIn('categoryList', content)
        self.assertIn('selectedCategories', content)
        self.assertIn(
            'vite_asset("src/entrypoints/QueMore.entry.tsx")', content
        )


    def test_edit_question_renders_react_edit_component(self):
        content = self._read_template(
            ['repz', 'templates', 'edit_question.html']
        )
        self.assertIn('id="edit-question-root"', content)
        self.assertIn(
            'vite_asset("src/entrypoints/EditQuestion.entry.tsx")',
            content,
        )


if __name__ == '__main__':
    unittest.main()
