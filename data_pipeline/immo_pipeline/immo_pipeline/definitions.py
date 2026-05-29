from dagster import Definitions, load_assets_from_modules
from dagster_dbt import DbtCliResource
from .assets import dbt_project_dbt_assets
from .project import dbt_project_project
from .schedules import schedules
from . import dvf
from . import dpe
from . import filosofi

python_assets = load_assets_from_modules([dvf, dpe, filosofi])

defs = Definitions(
    assets=[dbt_project_dbt_assets] + python_assets,
    schedules=schedules,
    resources={
        "dbt": DbtCliResource(project_dir=dbt_project_project),
    },
)