import os
import sys
from pathlib import Path

# Fix pour Windows : Ajouter le dossier .venv/Scripts au PATH pour trouver dbt.exe
venv_scripts = os.path.dirname(sys.executable)
if venv_scripts not in os.environ["PATH"]:
    os.environ["PATH"] = venv_scripts + os.pathsep + os.environ.get("PATH", "")


from dagster_dbt import DbtProject

dbt_project_project = DbtProject(
    project_dir=Path(__file__).joinpath("..", "..", "..", "dbt_project").resolve(),
    packaged_project_dir=Path(__file__).joinpath("..", "..", "dbt-project").resolve(),
)
dbt_project_project.prepare_if_dev()