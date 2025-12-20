To debug dev instance (locally only):
kubectl -n reps-dev port-forward svc/reps-dev 5558:5558 --address 127.0.0.1

kubectl -n reps-dev port-forward svc/reps-dev 5559:80 --address 127.0.0.1

 