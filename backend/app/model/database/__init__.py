"""Import all ORM models so `Base.metadata` knows about them at create_all time."""

from app.model.database.auto_match import AutoMatchSent, AutoMatchSubscription
from app.model.database.follow import StartupFollow, TalentFollow
from app.model.database.profile_embedding import ProfileEmbedding
from app.model.database.startup import Startup
from app.model.database.startup_profile_extension import StartupProfileExtension
from app.model.database.swipe_list import SwipeList
from app.model.database.talent import Talent
from app.model.database.talent_profile_extension import TalentProfileExtension

__all__ = [
    "Talent",
    "Startup",
    "TalentProfileExtension",
    "StartupProfileExtension",
    "TalentFollow",
    "StartupFollow",
    "ProfileEmbedding",
    "SwipeList",
    "AutoMatchSubscription",
    "AutoMatchSent",
]
