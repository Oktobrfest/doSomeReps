This website is designed to help you learn any topic by using spaced repetition, which is intended to remind you of what you're just about to forget, right before you forget it (ideally). 
This flask project can be located at: https://dosomereps.com 
I could use some help getting this project to the next level if anyone is interested. 
Either way, it's in a working state now and new features will be slowly added to it as time permits.
Enjoy. 

Local Python debugging uses uv and the root `.venv`:

```sh
uv venv --python "$(cat .python-version)" .venv
uv pip install -r requirements.txt -r requirements-dev.txt 'hatchet-sdk==1.42.1'
uv pip check
```

The Hatchet version must match the separate runtime install in `Dockerfile`.
`uv.toml` enables dependency validation; the requirements files remain the
dependency source. Open the repository root in VSCodium, select **Flask: .venv**
in Run and Debug, and press F5. The profile uses `.venv/bin/python` and serves
Flask at `http://127.0.0.1:5000`. Keep PostgreSQL and Redis available locally and
retain the existing `.env`, `app/.env`, and `app/dev.env` configuration.
