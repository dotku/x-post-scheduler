from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, LargeBinary, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "User"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    auth0Sub: Mapped[str] = mapped_column(String, unique=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)


class Post(Base):
    __tablename__ = "Post"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    content: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="scheduled")
    scheduledAt: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    postedAt: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    tweetId: Mapped[str | None] = mapped_column(String, nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)
    mediaAssetId: Mapped[str | None] = mapped_column(String, nullable=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    userId: Mapped[str | None] = mapped_column(String, nullable=True)


class KnowledgeSource(Base):
    __tablename__ = "KnowledgeSource"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    url: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    content: Mapped[str] = mapped_column(String, default="")
    pagesScraped: Mapped[int] = mapped_column(Integer, default=1)
    lastScraped: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    userId: Mapped[str | None] = mapped_column(String, nullable=True)


class MediaAsset(Base):
    __tablename__ = "MediaAsset"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    sourceUrl: Mapped[str] = mapped_column(String)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    mimeType: Mapped[str] = mapped_column(String, default="image/jpeg")
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    altText: Mapped[str | None] = mapped_column(String, nullable=True)
    isActive: Mapped[bool] = mapped_column(Boolean, default=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    userId: Mapped[str | None] = mapped_column(String, nullable=True)
