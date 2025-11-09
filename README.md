# Order Execution Engine – Mock DEX Router with Queue, WebSocket, and DB

This project simulates a backend system that processes cryptocurrency swap orders by routing them through different "DEXs" (Decentralized Exchanges). It demonstrates how real-world systems handle **order execution**, **queueing**, **routing**, and **real-time updates**. It also includes a simple front-end testing page built with HTML to interact with the API.

---

## ✨ Features

- Submit new orders through a REST API  
- Route each order to the best DEX based on mock prices and fees  
- Process orders in a Redis-backed queue using BullMQ  
- Stream status updates in real time using WebSocket  
- Store order records and history in a PostgreSQL database  
- Test coverage for both unit and integration scenarios  
- Deployable with Docker to platforms like Railway or Render  

---

## 🧠 How it Works

1. A user sends an order via the API.  
2. The order is added to a queue (not processed directly).  
3. A worker picks up the order and routes it through mock DEXs (Raydium and Meteora).  
4. Each DEX simulates a quote with randomized price and fees.  
5. The best DEX is selected, and a simulated swap is executed.  
6. Each processing step is broadcast to the frontend via WebSocket.  
7. All updates and order records are stored in PostgreSQL.  

---

## 🛠️ Tech Stack

| Component | Technology Used |
|------------|-----------------|
| Backend Framework | Fastify + TypeScript |
| Queue System | BullMQ (Redis) |
| Database | PostgreSQL |
| Real-time Updates | WebSocket |
| Deployment Ready | Dockerfile included |
| Testing | Vitest + Supertest |

---

## 🚀 Run Locally

### ✅ Requirements

- Node.js (version 20 or higher)  
- Docker Desktop  
- Redis and PostgreSQL running in containers  

---

### 📂 Step 1: Clone the Repository

git clone https://github.com/mrid07/OrderExecutionEngine_EternaLabsAssignment.git
cd order-execution-engine

yaml


---

### 🐳 Step 2: Start Postgres and Redis

docker compose up -d

yaml


This will start the following services:

- PostgreSQL on **localhost:5433**  
- Redis on **localhost:6379**

---

### 📝 Step 3: Add Environment Variables

Create a `.env` file in the root directory:

PORT=3000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

PGHOST=127.0.0.1
PGPORT=5433
PGDATABASE=oee
PGUSER=oee
PGPASSWORD=oee12345

QUEUE_NAME=orders
CONCURRENCY=5

yaml


---

### 📦 Step 4: Install Dependencies

npm install

yaml


---

### ▶️ Step 5: Run the Server

npm run dev

css


You should see output similar to:

[PG] Connected as oee@127.0.0.1:5433/oee
[MIGRATE] Applying migrations...
[MIGRATE] Done
[WORKER] Started
Server listening on http://localhost:3000

yaml


---

## 🧪 Test the API

### 🌐 Option 1: Using the Included Frontend

Open the **order-tester.html** file in your browser to:

- Submit new orders  
- Monitor real-time updates via WebSocket  
- Fetch stored order history  

---

### 🧾 Option 2: Using cURL

Create an order:

curl -X POST http://localhost:3000/api/orders/execute
-H "Content-Type: application/json"
-d '{"type":"market","tokenIn":"SOL","tokenOut":"USDC","amount":1,"slippageBps":100}'

makefile


Response:

{"orderId":"abc123"}

sql


View real-time updates using WebSocket:

ws://localhost:3000/api/orders/execute?orderId=abc123

yaml


---

## 📊 Database Schema

### `orders` Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Unique order ID |
| status | TEXT | Current order status (pending, confirmed, etc.) |
| token_in | TEXT | Input token (e.g. SOL) |
| token_out | TEXT | Output token (e.g. USDC) |
| amount | NUMERIC | Amount to swap |
| slippage_bps | INTEGER | Max allowed slippage (in basis points) |
| failure_reason | TEXT | Reason for failure (if any) |
| created_at | TIMESTAMP | Time when the order was created |
| updated_at | TIMESTAMP | Time when the order was last updated |

---

### `order_status_history` Table

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Auto-incremented ID |
| order_id | UUID | Reference to the orders table |
| status | TEXT | Status at this log entry |
| payload | JSONB | Additional metadata and details |
| created_at | TIMESTAMP | Timestamp when the status was logged |

---

## ✅ Tests

Run all tests:

npm test

sql


Run only unit tests:

npm run test:unit

pgsql


Run integration tests (make sure the server is running):
