# 🛰️ Distributed URL Shortener (Node.js + Express + Redis • Docker + Kubernetes)

A scalable URL shortening service that converts long URLs into unique 6-character short codes using **SHA-256 hashing**.  
Each mapping is stored temporarily in **Redis** for fast lookup (24-hour TTL) and permanently in **MySQL** for persistence.  
The app runs locally using **Docker Compose** and supports autoscaling in **Kubernetes** (via HPA).

---

## ✨ Features

- **POST /shorten** → returns `{ short_url, original_url, code }` (stored for 24h)  
- **GET /:code** → redirects to the original long URL (302) and increments click count  
- **/healthz** → returns service status for probes and monitoring  
- **Automatic scaling** → Kubernetes HPA scales Node.js pods based on load  
- **Stress testing** → `stress.js` sends multiple concurrent requests to simulate real-world traffic  

---
## 📂 Project Structure

.
├── server.js # Main Node.js + Express app ..
├── Dockerfile # Image build instructions
├── docker-compose.yml # Local environment (Web + Redis + MySQL)
├── package.json # Dependencies and scripts
├── package-lock.json
├── stress.js # Load testing script
├── schema.sql # SQL schema for MySQL table
└── kubernetes/ # Kubernetes manifests
├── configs/
│ ├── config-map.yaml
│ └── secrets.yaml
├── deployments/
│ ├── web-deployment.yaml
│ └── redis-deployment.yaml
├── services/
│ ├── web-service.yaml
│ └── redis-service.yaml
├── ingress/
│ └── ingress.yaml
└── hpa/
└── web-hpa.yaml

---

## 🧩 API Reference

### **POST /shorten**
**Body:**
json
{ "url": "https://example.com" }

Response:
{
  "short_url": "http://short.ly/Ab3XyZ",
  "original_url": "https://example.com",
  "code": "Ab3XyZ"
}

#📝 Notes

In Docker Compose, the app connects to redis:6379

In Kubernetes, it connects to redis-service:6379 (set in ConfigMap)

Data TTL: 24 hours in Redis, permanent storage in MySQL

Click counts tracked via INCR clicks:<code> in Redis

Use stress.js to simulate concurrent load and observe autoscaling
