# 🛰️ Distributed URL Shortener (Node.js + Express + Redis • Docker + Kubernetes)<br>
A small web service that takes a long URL, makes a short code (6 letters/digits), saves it in Redis, and later redirects you when you visit /<code>.
It runs locally with Docker Compose and can run in a cluster with Kubernetes (Service, Ingress, HPA autoscaling).

# ✨ Features

a) POST /shorten → returns { short_url, original_url, code } (stored for 24h)<br>
b) GET /:code → 302 redirect to the original URL + click counter<br>
c) Health: /healthz (OK for probes), / (JSON status)<br>


# 📂 Project Structure
.
├── server.js
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── stress.js
└── kubernetes/
    ├── configs/
    │   ├── config-map.yaml
    │   └── secrets.yaml
    ├── deployments/
    │   ├── web-deployment.yaml
    │   └── redis-deployment.yaml
    ├── services/
    │   ├── web-service.yaml
    │   └── redis-service.yaml
    ├── ingress/
    │   └── ingress.yaml
    └── hpa/
        └── web-hpa.yaml


# 🧩 API (very quick)
POST /shorten

Body:
{ "url": "<long-url>" }

Response:
{ "short_url": "http://short.ly/Ab3XyZ", "original_url": "...", "code": "Ab3XyZ" }

GET /:code

➡️ 302 redirect to the original URL.

# 📝 Notes

a) In Compose, the app talks to Redis at redis:6379.<br>
b) In K8s, the app talks to Redis at redis-service:6379 (from ConfigMap).<br>
c) The default TTL is 24h; clicks are tracked with INCR clicks:<code>.<br>
d) stress.js can send many concurrent requests to test performance/autoscaling.<br>
