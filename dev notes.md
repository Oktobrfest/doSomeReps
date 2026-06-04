To debug dev instance (locally only):
kubectl -n reps-dev port-forward svc/reps-dev 5558:5558 --address 127.0.0.1

kubectl -n reps-dev port-forward svc/reps-dev 5559:80 --address 127.0.0.1

 <!--for hatchet docker compose running first run this:-->
 kubectl -n hatchet port-forward --address 0.0.0.0 svc/hatchet-stack-engine 7070:7070 &
 kubectl -n hatchet port-forward --address 0.0.0.0 svc/hatchet-stack-api 8080:8080 &



hatchet updates:
helm upgrade hatchet-stack hatchet/hatchet-stack -n hatchet -f hatchet/values.yaml
