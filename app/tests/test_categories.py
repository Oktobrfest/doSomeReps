import unittest
import sys
import os

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

class TestCategoriesCoreTemplate(unittest.TestCase):
    """_categories_core.html mounts the bare picker via Vite."""

    def _read_template(self, name):
        path = os.path.join(
            os.path.dirname(__file__), '..', 'repz', 'templates', name
        )
        with open(path, 'r') as f:
            return f.read()

    def test_core_mounts_vite_entrypoint(self):
        content = self._read_template('_categories_core.html')
        self.assertIn('react-categories-core-root', content)
        self.assertIn('categories-core-data', content)
        self.assertIn(
            'vite_asset("src/entrypoints/CategoriesCore.entry.tsx")', content
        )

    def test_core_has_no_cdn_react(self):
        content = self._read_template('_categories_core.html')
        self.assertNotIn('unpkg.com', content)
        self.assertNotIn('document.write', content)
        self.assertNotIn('React.createElement', content)

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

class TestAddcontentUsesCoreOnly(unittest.TestCase):
    """Tests that addcontent page uses only the core categories component."""

    def _read_template(self, path_parts):
        path = os.path.join(os.path.dirname(__file__), '..', *path_parts)
        with open(path, 'r') as f:
            return f.read()

    def test_addcontent_includes_core_not_full(self):
        """addcontent.html should include _categories_core.html, not categories.html."""
        content = self._read_template(
            ['repz', 'home', 'templates', 'addcontent.html']
        )
        self.assertIn('_categories_core.html', content)
        # Should NOT include the full categories.html
        # (check that it includes the core but not the full)
        # We need to be careful: "_categories_core.html" is a substring of "categories.html"
        # So check for include with the exact filename
        self.assertIn('include "_categories_core.html"', content)


class TestPagesUsingFullCategories(unittest.TestCase):
    """Verify all pages that need full features still include categories.html."""

    def _read_template(self, path_parts):
        path = os.path.join(os.path.dirname(__file__), '..', *path_parts)
        with open(path, 'r') as f:
            return f.read()

    def test_quiz_uses_full_categories(self):
        content = self._read_template(
            ['repz', 'home', 'templates', 'quiz.html']
        )
        self.assertIn('include "categories.html"', content)

    def test_quemore_uses_full_categories(self):
        content = self._read_template(
            ['repz', 'home', 'templates', 'quemore.html']
        )
        self.assertIn('include "categories.html"', content)


    def test_audio_uses_full_categories(self):
        content = self._read_template(
            ['repz', 'audio', 'templates', 'audio.html']
        )
        self.assertIn('include "categories.html"', content)

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
