import pyotp
import qrcode
import io
import base64

def generate_totp_secret():
    """Generate a new base32 secret for TOTP."""
    return pyotp.random_base32()

def get_totp_uri(username, secret, issuer_name="Commission Decision App"):
    """Generate the provisioning URI for the QR code."""
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=username,
        issuer_name=issuer_name
    )

def generate_totp(secret):
    """Generate the current valid 6-digit TOTP code for the given secret."""
    if not secret:
        return None
    totp = pyotp.TOTP(secret)
    return totp.now()

def verify_totp_code(secret, code):
    """Verify a 6-digit TOTP code against the secret."""
    if not secret or not code:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code)

def get_totp_qr_base64(uri):
    """Generate a base64-encoded PNG QR code image from the URI."""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()
