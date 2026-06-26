To debug dev instance (locally only):
kubectl -n reps-dev port-forward svc/reps-dev 5558:5558 --address 127.0.0.1

kubectl -n reps-dev port-forward svc/reps-dev 5559:80 --address 127.0.0.1

 <!--for hatchet docker compose running first run this:-->
 just use script:
/hatchet/port-forward.sh

or do it manually if you like:
 sudo lsof -t -i :7070 -i :8080 -i :8888 | sudo xargs -r kill -9
 
 kubectl -n hatchet port-forward --address 0.0.0.0 svc/hatchet-stack-engine 7070:7070 &
 kubectl -n hatchet port-forward --address 0.0.0.0 svc/hatchet-stack-api 8080:8080 &
 kubectl -n hatchet port-forward --address 0.0.0.0 svc/caddy 8888:8080



hatchet updates:
helm upgrade hatchet-stack hatchet/hatchet-stack -n hatchet -f hatchet/values.yaml


to go to panel need to do above port forwards!


# Alembic Migrations Help

## Checking Status
Check current DB version:
  docker-compose run --rm reps_dev alembic current

Show migration history:
  docker-compose run --rm reps_dev alembic history --verbose

## Running Migrations
Upgrade to latest (head):
  docker-compose run --rm reps_dev alembic upgrade head

Upgrade by 1 step:
  docker-compose run --rm reps_dev alembic upgrade +1

Downgrade by 1 step:
  docker-compose run --rm reps_dev alembic downgrade -1

## Creating Migrations
Generate a new auto-detected migration:
  docker-compose run --rm reps_dev alembic revision --autogenerate -m "description"

# For prod alternatively use the migration job:
  kubectl delete job reps-prod-migration -n reps-prod
  kubectl apply -f k3/prod/db/jackie-migration-job.yaml
