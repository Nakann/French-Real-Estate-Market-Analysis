.PHONY: up down ingest dbt-run dev-front dagster-ui

up:
	docker-compose up -d

down:
	docker-compose down

dagster-ui:
	cd data_pipeline/immo_pipeline && ..\..\.venv\Scripts\dagster dev -p 3001

ingest:
	cd data_pipeline && python ingest.py

dbt-run:
	cd data_pipeline/dbt_project && ..\..\.venv\Scripts\dbt run

dev-front:
	cd dashboard && npm run dev
