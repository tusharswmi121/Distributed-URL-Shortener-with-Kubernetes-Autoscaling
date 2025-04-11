import requests
import time
import concurrent.futures
import random
import string
import argparse
from urllib.parse import urljoin

def generate_random_url():
    """Generate a random URL for testing"""
    return f"https://example.com/{''.join(random.choices(string.ascii_letters + string.digits, k=10))}"

def shorten_url(url, api_endpoint):
    """Send request to shorten URL with better error handling"""
    try:
        response = requests.post(
            urljoin(api_endpoint, '/shorten'),
            json={"url": url},
            headers={"Content-Type": "application/json"},
            timeout=5
        )
        response.raise_for_status()  # Raises exception for 4XX/5XX
        return response.json()["short_url"]
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {str(e)}")
        return None
    except ValueError as e:
        print(f"JSON decode error: {str(e)}")
        return None

def run_test(num_requests, concurrency, api_endpoint):
    """Run the stress test with improved logging"""
    print(f"\nTesting endpoint: {api_endpoint}")
    print(f"Sending {num_requests} requests with {concurrency} concurrent workers\n")

    start_time = time.time()
    success_count = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = []
        for i in range(num_requests):
            url = generate_random_url()
            futures.append(executor.submit(shorten_url, url, api_endpoint))

            # Print progress every 10%
            if (i+1) % max(1, num_requests//10) == 0:
                print(f"Submitted {i+1} requests...")

        for future in concurrent.futures.as_completed(futures):
            if future.result():
                success_count += 1

    duration = time.time() - start_time
    print(f"\nResults:")
    print(f"- Successes: {success_count}/{num_requests}")
    print(f"- Duration: {duration:.2f} seconds")
    print(f"- Rate: {num_requests/duration:.2f} requests/sec")
    print(f"- Success rate: {success_count/num_requests*100:.1f}%")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--requests', type=int, default=100)
    parser.add_argument('--concurrency', type=int, default=10)
    parser.add_argument('--api', type=str, default='http://localhost:5000')
    args = parser.parse_args()

    run_test(args.requests, args.concurrency, args.api)
