import os
import secrets
import time
from hashids import Hashids

_hashids = Hashids(min_length=6, salt=os.environ.get("HASHID_SALT", "calview"))


def new_short_id() -> str:
    # 48-bit random + time component, hashed via Hashids for nice short URLs
    n = int.from_bytes(secrets.token_bytes(5), "big") ^ int(time.time())
    return _hashids.encode(n)
