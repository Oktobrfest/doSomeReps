from flask_uploads import configure_uploads, IMAGES, UploadSet
from flask import current_app as app

images = UploadSet("images", IMAGES)
configure_uploads(app, images)
