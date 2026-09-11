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


class TestAudioRoutesAreReadOnly(unittest.TestCase):
    """
    CSRF only applies to POST/PUT/PATCH/DELETE, so audio stays unaffected only
    while its routes stay GETs. This fails loudly if one ever gains a verb.
    """

    def test_audio_blueprint_declares_only_get_routes(self):
        source = _read(APP_ROOT, 'audio', 'audio.py')
        methods = re.findall(r'@audio\.route\([^)]*methods=(\[[^\]]*\])', source)

        self.assertTrue(methods, 'expected audio routes to declare methods')
        for declared in methods:
            self.assertEqual(
                re.findall(r'"(\w+)"', declared),
                ['GET'],
                f'audio route declares {declared}; it now needs a CSRF token',
            )


class TestCsrfWiring(unittest.TestCase):
    """The token has to reach the browser, and the factory has to turn it on."""

    def test_factory_initialises_csrf(self):
        source = _read(APP_ROOT, '__init__.py')
        self.assertIn('csrf.init_app(app)', source)

    def test_token_is_not_time_limited(self):
        """
        A one hour cap would 400 the reader mid-quiz; the session is what
        expires the token. Both configs inherit this from Config.
        """
        from repz.configs.config import Config

        self.assertIsNone(Config.WTF_CSRF_TIME_LIMIT)

    def test_base_template_publishes_the_token(self):
        source = _read(APP_ROOT, 'templates', 'base.html')
        self.assertIn('name="csrf-token"', source)
        self.assertIn('content="{{ csrf_token() }}"', source)

    def test_every_page_template_extends_base(self):
        """A page that skipped base.html would ship without a token."""
        skip = {'base.html', 'footer.html', 'navigation.html', 'categories.html'}

        for dirpath, _, filenames in os.walk(APP_ROOT):
            for filename in filenames:
                if not filename.endswith('.html') or filename in skip:
                    continue
                source = _read(dirpath, filename)
                with self.subTest(template=filename):
                    self.assertRegex(
                        source,
                        r'{%\s*extends\s*[\'"]base\.html[\'"]',
                        f'{filename} does not extend base.html',
                    )


class TestFrontendSendsTheToken(unittest.TestCase):
    """
    lib/http.ts is the only place a token is attached, so every mutating fetch
    has to route its headers through it. A call site that builds headers by
    hand, or sends none at all, would 400 in production.
    """

    def _sources(self):
        for dirpath, _, filenames in os.walk(FRONTEND_SRC):
            for filename in filenames:
                if filename.endswith(('.ts', '.tsx')):
                    yield os.path.join(dirpath, filename), _read(dirpath, filename)

    def test_every_mutating_fetch_passes_headers_from_the_helper(self):
        # A fetch's options object, from the method up to the body.
        call = re.compile(
            r'method:\s*[\'"](?:POST|PUT|PATCH|DELETE)[\'"](?P<rest>.{0,200})',
            re.DOTALL,
        )

        for path, source in self._sources():
            for match in call.finditer(source):
                rest = match.group('rest')
                with self.subTest(file=os.path.relpath(path, FRONTEND_SRC)):
                    self.assertRegex(
                        rest,
                        r'headers:\s*(jsonHeaders|csrfHeaders)\(\)',
                        'mutating fetch does not take its headers from lib/http.ts',
                    )

    def test_no_hand_rolled_csrf_headers_remain(self):
        for path, source in self._sources():
            if path.endswith(os.path.join('lib', 'http.ts')):
                continue
            with self.subTest(file=os.path.relpath(path, FRONTEND_SRC)):
                self.assertNotIn('X-CSRFToken', source)
                self.assertNotIn('X-CSRF-Token', source)

    def test_helper_sends_the_header_flask_wtf_reads(self):
        source = _read(FRONTEND_SRC, 'lib', 'http.ts')
        self.assertIn('X-CSRFToken', source)
        self.assertIn('meta[name="csrf-token"]', source)


if __name__ == '__main__':
    unittest.main()
