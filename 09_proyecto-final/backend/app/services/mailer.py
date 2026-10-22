from email.message import EmailMessage
from html.parser import HTMLParser
from pathlib import Path

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config import settings

_templates = Environment(
    loader=FileSystemLoader(Path(__file__).parents[1] / "templates" / "email"),
    autoescape=select_autoescape(["html"]),
)


class _PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.link = None

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.link = dict(attrs).get("href")
        elif tag in {"br", "p", "h1", "h2", "li"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "a" and self.link:
            self.parts.append(f" ({self.link})")
            self.link = None
        elif tag in {"p", "h1", "h2", "li"}:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


async def send_mail(to, subject, html):
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    plain = _PlainText()
    plain.feed(html)
    message.set_content("".join(plain.parts).strip())
    message.add_alternative(html, subtype="html")
    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user or None,
        password=settings.smtp_password or None,
        start_tls=settings.smtp_starttls,
        timeout=15,
    )


async def send_password_reset(user, token):
    language = user.language if user.language in {"es", "en"} else "es"
    url = f"{settings.frontend_url.rstrip('/')}/{language}/reset-password?token={token}"
    html = _templates.get_template(f"{language}/password_reset.html").render(
        full_name=user.full_name, reset_url=url
    )
    subject = "Restablecer tu contraseña" if language == "es" else "Reset your password"
    await send_mail(user.email, subject, html)
