from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "BarberShop AI Assistant"
    app_env: str = "development"
    debug: bool = False
    secret_key: str = "change-me-in-production-min-32-chars"
    allowed_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost/barbershop"

    # JWT
    jwt_secret: str = "change-me-in-production-min-32-chars"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_max_tokens: int = 1024
    openai_context_messages: int = 20

    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "BarberShop AI"
    smtp_from_email: str = "noreply@barbershop.com"
    smtp_use_tls: bool = True

    # Rate limiting
    rate_limit_per_user: str = "10/minute"
    rate_limit_per_ip: str = "50/minute"
    verification_cooldown_seconds: int = 60

    # File uploads
    upload_max_size_mb: int = 10
    upload_allowed_types: str = "image/jpeg,image/png,image/webp,image/gif,application/pdf"

    # Chatbot
    bot_name: str = "Blade"
    bot_system_prompt: str = (
        "You are Blade, the AI assistant for a premium barbershop. "
        "Help clients with booking, services, pricing, and grooming advice. "
        "Be friendly, professional, and concise."
    )

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def allowed_upload_types(self) -> list[str]:
        return [t.strip() for t in self.upload_allowed_types.split(",") if t.strip()]

    @property
    def upload_max_bytes(self) -> int:
        return self.upload_max_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
