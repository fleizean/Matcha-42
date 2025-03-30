from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
from typing import Dict, Any
from jinja2 import Environment, select_autoescape, PackageLoader

from app.core.config import settings


# Configure FastMail
conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_TLS,
    MAIL_SSL_TLS=settings.MAIL_SSL,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    TEMPLATE_FOLDER="./app/templates/email"
)

# Create FastMail instance
fm = FastMail(conf)

# Jinja2 template environment
env = Environment(
    loader=PackageLoader("app", "templates/email"),
    autoescape=select_autoescape(['html', 'xml'])
)


async def send_email(email: EmailStr, subject: str, template_name: str, template_data: Dict[str, Any]):
    """
    Send an email using a template
    """
    # Render the template
    template = env.get_template(f"{template_name}.html")
    html_content = template.render(**template_data)
    
    # Create the message
    message = MessageSchema(
        subject=subject,
        recipients=[email],
        body=html_content,
        subtype="html"
    )
    
    # Send the email
    await fm.send_message(message)


async def send_verification_email(email: EmailStr, username: str, token: str):
    """
    Send a verification email
    """
    verification_url = f"{settings.FRONTEND_URL}/verify?token={token}"
    
    await send_email(
        email=email,
        subject="Verify your CrushIt account",
        template_name="verification",
        template_data={
            "username": username,
            "verification_url": verification_url
        }
    )


async def send_password_reset_email(email: EmailStr, username: str, token: str):
    """
    Send a password reset email
    """
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    await send_email(
        email=email,
        subject="Reset your CrushIt password",
        template_name="password_reset",
        template_data={
            "username": username,
            "reset_url": reset_url
        }
    )


async def send_notification_email(email: EmailStr, username: str, notification_type: str, sender_name: str = None):
    """
    Send a notification email for important events
    """
    notification_text = {
        "like": f"{sender_name} sizi beğendi!",
        "match": f"{sender_name} ile eşleştiniz!",
        "message": f"{sender_name}'den yeni bir mesaj!",
    }.get(notification_type, "CrushIt'den yeni bir bildirim!")
    
    login_url = f"{settings.FRONTEND_URL}/login"
    
    await send_email(
        email=email,
        subject=f"CrushIt - {notification_text}",
        template_name="notification",
        template_data={
            "username": username,
            "notification_text": notification_text,
            "login_url": login_url
        }
    )