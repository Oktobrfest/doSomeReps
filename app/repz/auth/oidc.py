from authlib.integrations.flask_client import OAuth

oauth = OAuth()

def register_oidc(app, cfg):
    """
    WHAT: Registers Authentik as an OAuth provider with split internal/external URLs
    WHY: Flask pod uses cluster DNS, but browser needs external hostname
    HOW: 
      - server_metadata_url uses cluster DNS for pod-to-pod communication
      - authorize_url override uses external hostname for browser redirects
    """
    oauth.init_app(app)

    # Internal cluster DNS for metadata and token exchange (pod-to-pod)
    issuer_internal = cfg.OIDC_ISSUER.rstrip("/")
    
    # External hostname for browser redirects
    issuer_external = cfg.OIDC_ISSUER_EXTERNAL.rstrip("/")
 

    oauth.register(
            name="authentik",
            client_id=cfg.OIDC_CLIENT_ID,
            client_secret=cfg.OIDC_CLIENT_SECRET,
            server_metadata_url=f"{issuer_internal}/application/o/reps/.well-known/openid-configuration",
            client_kwargs={
                "scope": cfg.OIDC_SCOPE,
            },
            # Override authorization endpoint to use external URL
            authorize_url=f"{issuer_external}/application/o/authorize/",
            # These stay internal (pod-to-pod)
            access_token_url=f"{issuer_internal}/application/o/token/",
            userinfo_url=f"{issuer_internal}/application/o/userinfo/",
        )