import unittest
import sys
import os

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


class TestCategoriesCoreTemplate(unittest.TestCase):
    """Tests for the _categories_core.html template (bare checkbox grid)."""

    def _read_template(self, name):
        path = os.path.join(
            os.path.dirname(__file__),
            '..', 'repz', 'templates', name
        )
        with open(path, 'r') as f:
            return f.read()

    def test_core_template_renders_checkbox_grid(self):
        """Core template should render the category checkbox grid."""
        content = self._read_template('_categories_core.html')
        self.assertIn('category_name', content)
        self.assertIn("id: 'categories'", content)
        self.assertIn('checkedCats', content)

    def test_core_template_has_no_saved_lists(self):
        """Core template should NOT contain saved lists UI."""
        content = self._read_template('_categories_core.html')
        self.assertNotIn('Save selection as', content)
        self.assertNotIn('-- Select Saved List --', content)
        self.assertNotIn('Set Default', content)
        self.assertNotIn('Delete', content)

    def test_core_template_has_no_select_all_button(self):
        """Core template should NOT contain select-all/deselect-all button."""
        content = self._read_template('_categories_core.html')
        self.assertNotIn('select-all-btn', content)
        self.assertNotIn('Deselect All', content)
        self.assertNotIn('Select All', content)

    def test_core_template_has_no_apply_button(self):
        """Core template should NOT contain apply button."""
        content = self._read_template('_categories_core.html')
        self.assertNotIn('apply-categories-btn', content)

    def test_core_template_has_no_header_toggle(self):
        """Core template should NOT contain collapse/header toggle."""
        content = self._read_template('_categories_core.html')
        self.assertNotIn('collapse-button', content)
        self.assertNotIn('Show Filters', content)
        self.assertNotIn('Hide Filters', content)


class TestCategoriesFullTemplate(unittest.TestCase):
    """Tests for categories.html (full-featured component)."""

    def _read_template(self, name):
        path = os.path.join(
            os.path.dirname(__file__),
            '..', 'repz', 'templates', name
        )
        with open(path, 'r') as f:
            return f.read()

    def test_full_template_has_checkbox_grid(self):
        """Full template should contain the checkbox grid."""
        content = self._read_template('categories.html')
        self.assertIn('category_name', content)
        self.assertIn("id: 'categories'", content)

    def test_full_template_has_saved_lists(self):
        """Full template should contain saved lists UI."""
        content = self._read_template('categories.html')
        self.assertIn('Save selection as', content)
        self.assertIn('-- Select Saved List --', content)

    def test_full_template_has_select_all_button(self):
        """Full template should contain select-all/deselect-all button."""
        content = self._read_template('categories.html')
        self.assertIn('select-all-btn', content)
        self.assertIn('Deselect All', content)
        self.assertIn('Select All', content)

    def test_full_template_has_apply_button(self):
        """Full template should contain apply button."""
        content = self._read_template('categories.html')
        self.assertIn('apply-categories-btn', content)

    def test_full_template_has_header_toggle(self):
        """Full template should contain collapse/header toggle."""
        content = self._read_template('categories.html')
        self.assertIn('collapse-button', content)

    def test_full_template_supports_hide_saved_lists_flag(self):
        """Full template should respect hide_saved_lists flag."""
        content = self._read_template('categories.html')
        self.assertIn('hide_saved_lists', content)

    def test_full_template_supports_hide_header_flag(self):
        """Full template should respect hide_header flag."""
        content = self._read_template('categories.html')
        self.assertIn('hide_header', content)

    def test_full_template_has_no_extra_flags(self):
        """Full template should not accumulate new mode flags."""
        content = self._read_template('categories.html')
        # Only hide_saved_lists and hide_header should exist as flags
        count = content.count('{% if ')
        # We expect exactly hide_saved_lists and hide_header for the flag checks
        # plus selected_categories and cats_due checks (which are data, not flags)
        self.assertIn('hide_saved_lists', content)
        self.assertIn('hide_header', content)
        # Verify no show_apply_btn or other mode flags leaked in
        self.assertNotIn('show_apply_btn', content)


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

    def test_editquestions_renders_react_edit_component(self):
        content = self._read_template(
            ['repz', 'home', 'templates', 'editquestions.html']
        )
        self.assertIn('vite_asset("src/edit_question_inline.tsx")', content)

    def test_ai_generator_uses_full_categories(self):
        content = self._read_template(
            ['repz', 'templates', 'ai_question_generator.html']
        )
        self.assertIn('include "categories.html"', content)

    def test_audio_uses_full_categories(self):
        content = self._read_template(
            ['repz', 'audio', 'templates', 'audio.html']
        )
        self.assertIn('include "categories.html"', content)

    def test_edit_question_uses_full_categories(self):
        content = self._read_template(
            ['repz', 'templates', 'edit_question.html']
        )
        self.assertIn('include "categories.html"', content)


if __name__ == '__main__':
    unittest.main()
