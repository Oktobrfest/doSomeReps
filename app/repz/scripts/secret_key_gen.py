import os
# import base64

# secret_key = base64.b64encode(os.urandom(32)).decode('utf-8')
# print(secret_key)


secret_key = os.urandom(32).hex()
print(secret_key)
