import os
import json
from flask import current_app, url_for
from markupsafe import Markup

# Cache the manifest file content in production
_manifest_cache = None

def vite_asset(entrypoint: str) -> Markup:
    """
    Jinja helper to render Vite assets.
    In development, it connects to the Vite dev server.
    In production, it reads from the manifest.json and renders compiled JS/CSS.
    """
    global _manifest_cache
    env = os.getenv('FLASK_ENV', 'production')

    if env == 'development':
        # Local development dev-server URL
        try:
            from flask import request
            host = request.host.split(':')[0] if request else 'localhost'
        except Exception:
            host = 'localhost'
        dev_server = f"http://{host}:5173"
        html = f"""
        <script type="module">
          import RefreshRuntime from '{dev_server}/@react-refresh'
          RefreshRuntime.injectIntoGlobalHook(window)
          window.$RefreshReg$ = () => {{}}
          window.$RefreshSig$ = () => (type) => type
          window.__vite_plugin_react_preamble_installed__ = true
        </script>
        <script type="module" src="{dev_server}/@vite/client"></script>
        <script type="module" src="{dev_server}/{entrypoint}"></script>
        """
        return Markup(html)

    # Production mode: Read from manifest
    dist_dir = os.path.join(current_app.root_path, 'static', 'vite_dist')
    
    # Try different potential manifest paths (Vite 5+ by default puts it in .vite/manifest.json)
    manifest_paths = [
        os.path.join(dist_dir, '.vite', 'manifest.json'),
        os.path.join(dist_dir, 'manifest.json'),
    ]

    manifest = None
    if _manifest_cache is not None:
        manifest = _manifest_cache
    else:
        for path in manifest_paths:
            if os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        manifest = json.load(f)
                        _manifest_cache = manifest
                        break
                except Exception as e:
                    current_app.logger.error(f"Error reading Vite manifest at {path}: {e}")

    if not manifest:
        msg = f"Vite manifest not found. Did you run 'npm run build' inside 'frontend'? checked paths: {manifest_paths}"
        current_app.logger.error(msg)
        # Return an HTML comment and trigger a console error so it shows in browser logs immediately
        return Markup(f"<!-- {msg} -->\n<script>console.error({json.dumps(msg)});</script>")

    # Resolve entrypoint in manifest
    entry_info = manifest.get(entrypoint)
    if not entry_info:
        msg = f"Vite entrypoint {entrypoint} not found in manifest."
        current_app.logger.error(msg)
        return Markup(f"<!-- {msg} -->\n<script>console.error({json.dumps(msg)});</script>")

    html_parts = []
    seen_css = set()
    seen_js = set()

    def _collect(entry_key: str):
        """Recursively collect JS and CSS from entry and all imported chunks."""
        info = manifest.get(entry_key)
        if not info:
            return

        js_file = info.get('file')
        if js_file and js_file not in seen_js:
            seen_js.add(js_file)
            # Only emit <script> for the top-level entry; imported chunks are
            # loaded dynamically by the browser when the entry module executes.
            # Adding them here would double-load and potentially break module
            # initialization order.

        for css_file in info.get('css', []):
            if css_file not in seen_css:
                seen_css.add(css_file)
                css_url = url_for('static', filename=f'vite_dist/{css_file}')
                html_parts.append(f'<link rel="stylesheet" href="{css_url}">')

        for import_key in info.get('imports', []):
            _collect(import_key)

    # Start from the entrypoint
    _collect(entrypoint)

    # Emit the entry JS script tag
    entry_js = entry_info.get('file')
    if entry_js:
        js_url = url_for('static', filename=f'vite_dist/{entry_js}')
        html_parts.insert(0, f'<script type="module" src="{js_url}"></script>')

    return Markup('\n'.join(html_parts))
