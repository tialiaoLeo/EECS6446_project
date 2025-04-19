import random
import requests
import concurrent.futures
import time
import matplotlib.pyplot as plt
import numpy as np
import csv
import numpy as np
time_interval = 1
baristaItems = [{"itemType": 1}, {"itemType": 2}, {"itemType": 3}, {"itemType": 4}, {"itemType": 5}]
kitchenItems = [{"itemType": 6}, {"itemType": 7}, {"itemType": 8}, {"itemType": 9}, {"itemType": 10}]
start_time = time.time()
graph_values = {}
config = {
        "rabbitms_interval": 8,
        "rabbitms_timeout": 8,
        "rabbitms_retries": 2,
        "cb_failureThreshold": 3,
        "cb_retryTimeout": 5,
        "num_users": 100,  # 4 concurrent users
        "num_requests_per_user": 50  # 500 total requests per user
    }

def call():
    size = random.randint(1, len(baristaItems))
    random_bar = random.sample(baristaItems, size)
    random_kit = random.sample(kitchenItems, size)

    order = {
        "commandType": 0,
        "orderSource": 0,
        "location": 0,
        "loyaltyMemberId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "timestamp": "2022-07-04T11:38:00.210Z",
        "baristaItems": random_bar,
        "kitchenItems": random_kit
    }
    t = time.time() - start_time
    try:
        response = requests.post(
            "http://localhost:5000/v1/api/orders",
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json=order  # Automatically converts Python dict to JSON
        )
        if t not in graph_values:
            graph_values[t] = response.status_code
        print(f"Order created: {response.status_code} tms: {t:.2f} with order:{random_bar} \n")
        response.raise_for_status()  # Raise error for HTTP failure
    except requests.exceptions.RequestException as e:
        if t not in graph_values:
            graph_values[t] = 500
        print(f"Request failed: {e}")


# Simulate 4 users making concurrent requests
def simulate_users():
    num_users = config["num_users"]  # 4 concurrent users
    num_requests_per_user = config["num_requests_per_user"]  # 500 total requests per user

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_users) as executor:
        futures = [executor.submit(call) for _ in range(num_requests_per_user * num_users)]
        concurrent.futures.wait(futures)  # Wait for all requests to complete


simulate_users()

# draw the graph
def plot_response_graph(graph_values, interval=time_interval):
    # Convert dictionary to list of (time, code)
    data = list(graph_values.items())

    # Determine time bins
    max_time = max(graph_values.keys())
    bins = np.arange(0, max_time + interval, interval)

    # Count responses
    count_200 = {b: 0 for b in bins}
    count_500 = {b: 0 for b in bins}

    for time, code in data:
        bin_start = max([b for b in bins if b <= time])
        if code == 200:
            count_200[bin_start] += 1
        elif code == 500:
            count_500[bin_start] += 1

    x = list(count_200.keys())
    y_200 = [count_200[t] for t in x]
    y_500 = [count_500[t] for t in x]

    # Plot
    plt.figure(figsize=(12, 6))
    plt.plot(x, y_200, label='200 Response Codes', marker='o')
    plt.plot(x, y_500, label='500 Response Codes', marker='x')

    # Reduce x-axis tick labels for readability
    max_labels = 20  # Adjust this depending on how dense you want the labels
    step = max(1, len(x) // max_labels)
    plt.xticks(x[::step])  # Show only every Nth tick

    plt.xlabel('Time (seconds)')
    plt.ylabel('Count')
    plt.title('Response Codes Count in 2-Second Intervals')
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.show()

# write into csv
def export_response_summary_to_csv(graph_values, interval=time_interval, filename="response_summary.csv"):
    # Static configuration attributes


    # Determine time bins
    max_time = max(graph_values.keys())
    bins = np.arange(0, max_time + interval, interval)

    # Initialize counters
    count_200 = {b: 0 for b in bins}
    count_500 = {b: 0 for b in bins}

    # Count response codes in each bin
    for time, code in graph_values.items():
        bin_start = max([b for b in bins if b <= time])
        if code == 200:
            count_200[bin_start] += 1
        elif code == 500:
            count_500[bin_start] += 1

    # Write to CSV
    with open(filename, mode='a', newline='') as csvfile:
        writer = csv.writer(csvfile)

        # Header row
        #header = ["time", "200 response", "500 response"] + list(config.keys())
        #writer.writerow(header)

        # Data rows
        for t in bins:
            row = [
                int(t + interval),  # End of the interval
                count_200[t],
                count_500[t]
            ] + list(config.values())
            writer.writerow(row)

    print(f"CSV exported to '{filename}'")
export_response_summary_to_csv(graph_values)
plot_response_graph(graph_values)


