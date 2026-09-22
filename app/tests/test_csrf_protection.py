import os
import re
import sys
import unittest

from flask import Flask

# Add the parent directory of 'repz' to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from repz.extensions import csrf

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
APP_ROOT = os.path.join(REPO_ROOT, 'app', 'repz')
FRONTEND_SRC = os.path.join(REPO_ROOT, 'frontend', 'src')


def _read(*parts):
    with open(os.path.join(*parts), 'r') as handle:
        return handle.read()


class TestCsrfEnforcement(unittest.TestCase):
    """
    The shared CSRFProtect instance guards the whole app, so these pin the
    behaviour the SPA depends on: header-borne tokens pass, absent ones do not,
    and reads are never touched.
    """

    def setUp(self):
        self.app = Flask(__name__)
        self.app.config['SECRET_KEY'] = 'test-secret'
        self.app.config['WTF_CSRF_SSL_STRICT'] = False
        csrf.init_app(self.app)

        @self.app.route('/mutate', methods=['POST', 'PUT', 'PATCH', 'DELETE'])
        def mutate():
            return 'ok'

        @self.app.route('/read', methods=['GET'])
        def read():
            from flask_wtf.csrf import generate_csrf
            return generate_csrf()

        self.client = self.app.test_client()

    def _token(self):
        """The token base.html would render, bound to this client's session."""
        return self.client.get('/read').get_data(as_text=True)

    def test_post_without_token_is_rejected(self):
        self.assertEqual(self.client.post('/mutate').status_code, 400)

    def test_post_with_header_token_is_accepted(self):
        response = self.client.post(
            '/mutate', headers={'X-CSRFToken': self._token()}
        )
        self.assertEqual(response.status_code, 200)

    def test_form_field_token_is_accepted(self):
        """Native form posts (add content, profile) send it as a field."""
        response = self.client.post(
            '/mutate', data={'csrf_token': self._token()}
        )
        self.assertEqual(response.status_code, 200)

    def test_every_mutating_method_is_guarded(self):
        for method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            with self.subTest(method=method):
                response = self.client.open('/mutate', method=method)
                self.assertEqual(response.status_code, 400)

    def test_get_is_untouched(self):
        """Audio playback is GET-only and must not need a token."""
        self.assertEqual(self.client.get('/read').status_code, 200)

    def test_stale_token_is_rejected(self):
        response = self.client.post(
            '/mutate', headers={'X-CSRFToken': 'not-a-real-token'}
        )
        self.assertEqual(response.status_code, 400)

    def test_nothing_is_exempted(self):
        self.assertEqual(csrf._exempt_views, set())
        self.assertEqual(csrf._exempt_blueprints, set())


if __name__ == '__main__':
    unittest.main()
