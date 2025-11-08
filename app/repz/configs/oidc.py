import os

class OIDCConfig:
    # Issuer & redirect come from your ConfigMap (already created)
    OIDC_ISSUER = os.environ.get("OIDC_ISSUER", "http://authentik.local.test").rstrip("/")
    OIDC_REDIRECT_URI = os.environ.get("OIDC_REDIRECT_URI", "http://reps.local.test/auth/callback")

    # Client id/secret from a k8s Secret (we'll create it in Step 2)
    OIDC_CLIENT_ID = os.environ.get("OIDC_CLIENT_ID", "")
    OIDC_CLIENT_SECRET = os.environ.get("OIDC_CLIENT_SECRET", "")

    # Include 'groups' so we can do role mapping (admin/user)
    OIDC_SCOPE = os.environ.get("OIDC_SCOPE", "openid email profile groups")
