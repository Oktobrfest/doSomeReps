import random
import string
import sys

def random_string(length):
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

if len(sys.argv) != 2:
    print(f"Usage: python3 {sys.argv[0]} <length>")
    sys.exit(1)

length = int(sys.argv[1])
print(random_string(length))