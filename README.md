# Start minikube and point Docker to minikube's daemon
minikube start
eval $(minikube docker-env)

# Build the Node image (matches deployment image field)
docker build -t url-shortener_node:latest .

# Apply manifests (configs/services/ingress/HPA unchanged)
kubectl apply -f kubernetes/configs/
kubectl apply -f kubernetes/deployments/
kubectl apply -f kubernetes/services/
kubectl apply -f kubernetes/ingress/
kubectl apply -f kubernetes/hpa/

# (Optional) Add short.ly → /etc/hosts with the minikube IP or use Host header
IP=$(minikube ip)
curl -X POST -H "Host: short.ly" -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' \
  http://$IP/shorten
