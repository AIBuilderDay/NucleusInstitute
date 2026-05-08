"""Import all ORM models so `Base.metadata` knows about them at create_all time."""

from app.model.database.startup import Startup
from app.model.database.talent import Talent

__all__ = ["Talent", "Startup"]
