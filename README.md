# K8s-Powered URL Shortener  

A scalable **URL Shortener** built with Kubernetes (K8s), Docker, Flask, and Redis. This project demonstrates cloud-native deployment with auto-scaling, ingress routing, and high availability.  

## Features  

- **Shorten URLs** – Convert long URLs into short, shareable links.  
- **Kubernetes Deployment** – Runs in a K8s cluster with Redis for caching.  
- **Horizontal Pod Autoscaling (HPA)** – Automatically scales based on traffic.  
- **Ingress Routing** – Custom domain support (e.g., `short.ly`).  
- **Load Testing** – Includes a Python script for stress testing.  
- **Dockerized** – Containerized for easy deployment.  

---

## Prerequisites  

- [Minikube](https://minikube.sigs.k8s.io/docs/start/) (for local K8s cluster)  
- [kubectl](https://kubernetes.io/docs/tasks/tools/) (Kubernetes CLI)  
- [Docker](https://docs.docker.com/get-docker/) (for building images)  
- Python 3.9+ (for running the Flask app)  

---
##Project Structure
app.py              # Flask application
Dockerfile          # Docker build configuration
docker-compose.yml  # Local development setup
stress_test.py      # Load testing script
requirements.txt    # Python dependencies
kubernetes/
├── configs/        # ConfigMaps and Secrets
├── deployments/    # Kubernetes Deployments
├── services/       # Kubernetes Services
├── ingress/        # Ingress configuration
└── hpa/            # Horizontal Pod Autoscaler config
## Quick Start  

### 1. Start Minikube & Build Docker Image

```bash
minikube start
eval $(minikube docker-env)  # Use Minikube's Docker daemon
docker build -t url-shortener_web:latest .
```

### 2. Deploy Kubernetes Resources

```bash
kubectl apply -f kubernetes/configs/
kubectl apply -f kubernetes/deployments/
kubectl apply -f kubernetes/services/
kubectl apply -f kubernetes/ingress/
kubectl apply -f kubernetes/hpa/
```

### 3. Access the URL Shortener

#### Shorten the URL using Curl with Ingress

```bash
curl -X POST -H "Host: short.ly" -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' \
  http://$(minikube ip)/shorten
```
#### Expected Output
```bash
{"code":"HYo8ui","original_url":"https://example.com","short_url":"http://short.ly/HYo8ui"}
```

#### Stress Testing
```bash
python stress_test.py \
  --api "http://$(minikube ip):32192/shorten" \
  --requests 1000 \
  --concurrency 50
```



