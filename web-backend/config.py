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
    app_name: str = "BarberShop Web"
    app_env: str = "development"
    debug: bool = False
    allowed_origins: str = "http://localhost:3000"

    # Database — same variable name as chatbot backend so one .env works for both
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost/barbershop"

    # Resend (replaces direct SMTP on cloud hosts that block port 587)
    resend_api_key: str = ""

    # Email (kept for local-dev SMTP fallback)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "BarberShop"
    smtp_from_email: str = "noreply@barbershop.com"
    smtp_use_tls: bool = True

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
