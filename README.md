# Distributed URL Shortener with Kubernetes Autoscaling — Node.js + Express + Redis (Docker + Kubernetes)

A simple, cloud-ready URL shortener. It creates **random 6-character codes** for long URLs, stores them in **Redis**, and redirects on `GET /:code`. Containerized with **Docker** and deployable to **Kubernetes** (Service, Ingress, HPA).

## Features
- `POST /shorten` → `{ short_url, original_url, code }` (24h TTL)
- `GET /:code` → 302 redirect + click counter
- Health: `/healthz` (OK), `/` (JSON status)
- Docker Compose for local dev; K8s manifests for cluster
- HPA demo (CPU target 50%, min 2, max 10)

## Project Structure
.
├── server.js
├── Dockerfile
├── docker-compose.yml
├── package.json
├── stress.js
└── kubernetes/
├── configs/ (config-map.yaml, secrets.yaml)
├── deployments/ (web-deployment.yaml, redis-deployment.yaml)
├── services/ (web-service.yaml, redis-service.yaml)
├── ingress/ (ingress.yaml)
└── hpa/ (web-hpa.yaml)


Run Locally (Docker Compose)
## Quick Start (Docker Compose)
```bash
docker compose up --build
# Health
curl -sS http://localhost:3000/healthz
# Shorten a URL
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}' \
  http://localhost:3000/shorten
# Follow the code (replace CODE)
curl -i http://localhost:3000/CODE

Run on Kubernetes (Minikube)

minikube start
eval $(minikube docker-env)
docker build -t url-shortener_node:latest .

kubectl apply -f kubernetes/configs/
kubectl apply -f kubernetes/deployments/
kubectl apply -f kubernetes/services/
kubectl apply -f kubernetes/hpa/

# Access via port-forward
kubectl port-forward svc/web-service 8081:80
curl -sS http://127.0.0.1:8081/healthz

API

POST /shorten → { "url": "<long-url>" } ⇒ { short_url, original_url, code }

GET /:code → 302 redirect

Notes

In Kubernetes, the app talks to Redis at redis-service:6379 (via ConfigMap).

HPA scales web pods between 2–10 based on 50% CPU (requires metrics-server).

stress.js can send concurrent requests to test performance/autoscaling.
