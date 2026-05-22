import unittest
import sys
import os

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import Flask
from werkzeug.datastructures import MultiDict
from repz.ai.profile_forms import AIProfileForm

class TestProfileLanguagesValidation(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config['WTF_CSRF_ENABLED'] = False
        self.app.config['SECRET_KEY'] = 'test-secret'
        self.ctx = self.app.test_request_context()
        self.ctx.push()

    def tearDown(self):
        self.ctx.pop()

    def test_validation_empty_languages(self):
        form = AIProfileForm(MultiDict([]))
        form.languages.choices = [("en_US", "en_US"), ("fr_FR", "fr_FR"), ("es_ES", "es_ES")]
        self.assertTrue(form.validate())

    def test_validation_valid_languages(self):
        form = AIProfileForm(MultiDict([("languages", "en_US"), ("languages", "fr_FR")]))
        form.languages.choices = [("en_US", "en_US"), ("fr_FR", "fr_FR"), ("es_ES", "es_ES")]
        self.assertTrue(form.validate())

    def test_validation_too_many_languages(self):
        form = AIProfileForm(MultiDict([
            ("languages", "en_US"),
            ("languages", "fr_FR"),
            ("languages", "es_ES"),
            ("languages", "de_DE")
        ]))
        form.languages.choices = [("en_US", "en_US"), ("fr_FR", "fr_FR"), ("es_ES", "es_ES"), ("de_DE", "de_DE")]
        self.assertFalse(form.validate())
        self.assertIn("You can select up to 3 languages only.", form.languages.errors)

    def test_validation_invalid_language_choice(self):
        form = AIProfileForm(MultiDict([("languages", "en_US"), ("languages", "it_IT")]))
        form.languages.choices = [("en_US", "en_US"), ("fr_FR", "fr_FR")]
        self.assertFalse(form.validate())
        has_invalid_choice_error = any(
            "not a valid" in err.lower() or "not a valid choice" in err.lower()
            for err in form.languages.errors
        )
        self.assertTrue(has_invalid_choice_error)
