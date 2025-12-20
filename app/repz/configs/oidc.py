import os

class OIDCConfig:
    # Issuer & redirect come from your ConfigMap (already created)
    OIDC_ISSUER = os.environ.get(
        "OIDC_ISSUER", 
        "http://authentik.authentik.svc.cluster.local"
    ).rstrip("/")
    
    # External hostname - for browser redirects
    OIDC_ISSUER_EXTERNAL = os.environ.get(
        "OIDC_ISSUER_EXTERNAL", 
        "http://authentik.local.test"
    ).rstrip("/")
    
    # Browser redirect - uses localhost because of port-forward
    OIDC_REDIRECT_URI = os.environ.get(
        "OIDC_REDIRECT_URI", 
        "http://127.0.0.1:5559/auth/callback"
    )

    # Client id/secret from a k8s Secret (we'll create it in Step 2)
    OIDC_CLIENT_ID = os.environ.get("OIDC_CLIENT_ID", "")
    OIDC_CLIENT_SECRET = os.environ.get("OIDC_CLIENT_SECRET", "")

    # Include 'groups' so we can do role mapping (admin/user)
    OIDC_SCOPE = os.environ.get("OIDC_SCOPE", "openid email profile groups")

    OIDC_PROVIDER_SLUG = os.environ.get("OIDC_PROVIDER_SLUG", "reps").strip().strip("/")

    OIDC_ENROLLMENT_FLOW_SLUG = os.environ.get("OIDC_ENROLLMENT_FLOW_SLUG", "default-enrollment-flow").strip().strip("/")

