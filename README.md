# EECS6446 Final Project - Resilience Benchmarking in Microservices

This project evaluates the impact of **Retry** and **Circuit Breaker** mechanisms on the performance and fault tolerance of a microservices system. Based on the open-source [`go-coffeeshop`](https://github.com/thangchung/go-coffeeshop) architecture, the system is stress-tested under concurrent load and its responses are used to train predictive models.

Please noted that script.js and docker-compose.yaml are the replication from https://github.com/thangchung/go-coffeeshop

## 🚀 Project Objectives

- Simulate high-concurrency API traffic to test service stability.
- Apply traffic management policies such as Retry (RabbitMQ) and Circuit Breaker (frontend).
- Collect performance data (e.g., HTTP 200/500 responses, CPU usage, memory, network I/O).
- Train machine learning models to **predict system failures** based on configurations and workload.

## 🧱 Technologies Used

- Python (for load simulation and ML training)
- Docker Compose (for containerized service deployment)
- RabbitMQ (message broker)
- gRPC-Gateway (REST ↔ gRPC bridge)
- scikit-learn, CatBoost, LightGBM (for model training and evaluation)
- Matplotlib (for visualizing results)

## 📊 Dataset

The system logs runtime metrics including:

- `time`: Interval in seconds
- `200 response`, `500 response`: Response codes per interval
- `rabbitms_interval`, `rabbitms_timeout`, `rabbitms_retries`: Retry settings
- `cb_failureThreshold`, `cb_retryTimeout`: Circuit breaker settings
- `num_users`, `num_requests_per_user`: Simulated load

These logs are saved to `response_summary.csv` and used for training ML models to forecast the number of failed responses (HTTP 500) at a given timestamp.

## 🧠 Model Comparison

Five machine learning models were evaluated:

- Random Forest Regressor ✅ (Best performance)
- HistGradientBoosting
- CatBoost
- LightGBM
- MLP Regressor

**Random Forest** achieved the lowest MAE (~11.00) and proved most robust for this dataset.

## 📈 Key Findings

- Retry mechanisms reduce transient failures but can increase CPU usage.
- Circuit breakers stabilize recovery behavior and reduce system overload.
- A combined approach yields the best performance under high user load.
- Machine learning models can effectively predict service failure trends.

