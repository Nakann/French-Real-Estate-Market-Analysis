from setuptools import find_packages, setup

setup(
    name="immo_pipeline",
    version="0.0.1",
    packages=find_packages(),
    package_data={
        "immo_pipeline": [
            "dbt-project/**/*",
        ],
    },
    install_requires=[
        "dagster",
        "dagster-cloud",
        "dagster-dbt",
        "dbt-core<1.12",
        "dbt-postgres<1.12",
    ],
    extras_require={
        "dev": [
            "dagster-webserver",
        ]
    },
)