from flask import Flask, request, jsonify, redirect, make_response
import redis
import string
import random
import os
from urllib.parse import urlparse

app = Flask(__name__)

# Configuration
BASE_DOMAIN = "short.ly"  # Your custom short domain
REDIS_HOST = os.getenv('REDIS_HOST', 'redis-service')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
SHORT_CODE_LENGTH = 6

# Redis connection with robust error handling
class RedisManager:
    def __init__(self):
        self.connection = None
        self.connect()

    def connect(self):
        try:
            self.connection = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=0,
                socket_connect_timeout=2,
                socket_timeout=2,
                decode_responses=True
            )
            self.connection.ping()  # Test connection
        except redis.RedisError as e:
            app.logger.error(f"Redis connection error: {e}")
            raise

    def get_connection(self):
        if not self.connection or not self.connection.ping():
            self.connect()
        return self.connection

redis_manager = RedisManager()

def generate_short_code():
    """Generate a random short code using cryptographically secure random"""
    chars = string.ascii_letters + string.digits
    return ''.join(random.SystemRandom().choice(chars) for _ in range(SHORT_CODE_LENGTH))

def validate_url(url):
    """Validate URL format"""
    try:
        result = urlparse(url)
        return all([result.scheme in ('http', 'https'), result.netloc])
    except:
        return False

# CORS Support
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

@app.route('/shorten', methods=['POST', 'OPTIONS'])
def shorten_url():
    """URL shortening endpoint with CORS support"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()

    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'URL is required'}), 400

        long_url = data['url'].strip()
        if not validate_url(long_url):
            return jsonify({'error': 'Invalid URL format'}), 400

        short_code = generate_short_code()
        redis_manager.get_connection().setex(
            name=short_code,
            time=86400,  # 24h TTL
            value=long_url
        )

        return jsonify({
            'short_url': f"http://{BASE_DOMAIN}/{short_code}",
            'original_url': long_url,
            'code': short_code
        }), 201
    except redis.RedisError as e:
        return jsonify({'error': f'Storage error: {str(e)}'}), 503
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

def _build_cors_preflight_response():
    response = make_response()
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "*")
    response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
    return response

@app.route('/<short_code>', methods=['GET'])
def redirect_to_long_url(short_code):
    """Redirection endpoint with analytics"""
    try:
        conn = redis_manager.get_connection()
        long_url = conn.get(short_code)

        if not long_url:
            return jsonify({'error': 'Short URL not found'}), 404

        # Track clicks (optional)
        conn.incr(f"clicks:{short_code}")

        return redirect(long_url, code=302)
    except redis.RedisError:
        return jsonify({'error': 'Service unavailable'}), 503
    except Exception:
        return jsonify({'error': 'Internal server error'}), 500

# Health endpoints
@app.route('/')
def health_check():
    """Comprehensive health check"""
    try:
        conn = redis_manager.get_connection()
        if conn.ping():
            return jsonify({
                "status": "healthy",
                "redis": "connected",
                "version": "1.0",
                "domain": BASE_DOMAIN
            }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

@app.route('/healthz')
def healthz():
    """Kubernetes health check endpoint"""
    try:
        if redis_manager.get_connection().ping():
            return "OK", 200
        return "Redis unavailable", 503
    except Exception as e:
        return f"Service error: {str(e)}", 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
