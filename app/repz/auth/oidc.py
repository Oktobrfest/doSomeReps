from authlib.integrations.flask_client import OAuth

oauth = OAuth()

def register_oidc(app, cfg):
    oauth.init_app(app)
    issuer = cfg.OIDC_ISSUER.rstrip("/")
    oauth.register(
        name="authentik",
        client_id=cfg.OIDC_CLIENT_ID,
        client_secret=cfg.OIDC_CLIENT_SECRET,
        server_metadata_url=f"{issuer}/.well-known/openid-configuration",
        client_kwargs={"scope": cfg.OIDC_SCOPE},
    )
