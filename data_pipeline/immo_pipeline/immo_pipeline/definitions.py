from dagster import Definitions, load_assets_from_modules
from dagster_dbt import DbtCliResource
from .assets import dbt_project_dbt_assets
from .project import dbt_project_project
from .schedules import schedules
from . import dvf, dpe, filosofi, communes, ban, inondations
import warnings

# Ignore SQLAlchemy warnings from GeoPandas
warnings.filterwarnings("ignore", category=UserWarning, module="pandas.io.sql")

all_assets = load_assets_from_modules([dvf, dpe, filosofi, communes, ban, inondations])

defs = Definitions(
    assets=[dbt_project_dbt_assets] + all_assets,
    schedules=schedules,
    resources={
        "dbt": DbtCliResource(project_dir=dbt_project_project),
    },
)