import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, code: str) -> bool:
    """6 xonali tasdiqlash kodini SMTP orqali emailga yuboradi."""
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD

    if not user or not password:
        logger.error("SMTP sozlanmagan: SMTP_USER / SMTP_PASSWORD bo'sh")
        return False

    msg = EmailMessage()
    msg["Subject"] = "FRAGMENTLY-API — Email Tasdiqlash Kodi"
    msg["From"] = user
    msg["To"] = to_email
    msg.set_content(
        "Salom!\n\n"
        "FRAGMENTLY-API akkauntingizni tasdiqlash uchun 6 xonali kod:\n\n"
        f"    {code}\n\n"
        "Kod 10 daqiqa davomida amal qiladi. Agar bu so'rovni siz amalga oshirmagan "
        "bo'lsangiz, ushbu xatni e'tiborsiz qoldiring.\n\n"
        "FRAGMENTLY-API"
    )

    try:
        if port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.ehlo()
                server.starttls()
                server.login(user, password)
                server.send_message(msg)

        logger.info("Verification email sent to %s", to_email)
        return True
    except Exception as exc:
        logger.error("SMTP email yuborishda xatolik (%s:%s): %s", host, port, exc)
        return False
