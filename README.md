# 🧠 Order Execution Engine – Mock DEX Router with Queue, WebSocket, and Database

This project simulates a backend **order execution system** similar to those used in decentralized exchanges (DEXs).  
It demonstrates how real-world trading systems handle **asynchronous order processing**, **queueing**, **routing logic**, and **real-time status streaming**.

The system routes swap orders across mock DEXs (Raydium and Meteora), processes them using a Redis-backed queue, broadcasts updates over WebSocket, and persists data in PostgreSQL.

---

## 📖 Overview

When a user submits a swap order, it is **queued instead of being processed immediately**.  
This approach allows the backend to handle high loads efficiently by decoupling API request handling from the actual execution logic.

The engine simulates price quotes from two DEXs and routes each order to the best one based on simulated price and fees.  
Throughout the process, order updates are streamed to clients in real time via WebSocket, and all order data is stored in a database for auditing and analytics.

---

## ⚙️ Design Decisions

### 1. **Fastify + TypeScript (Backend Framework)**
- **Decision:** Use **Fastify** instead of Express for better performance and native TypeScript support.  
- **Reasoning:** Fastify provides out-of-the-box schema validation, async-friendly APIs, and a low-overhead HTTP server—ideal for high-throughput systems like trading engines.

---

### 2. **Queue System: BullMQ + Redis**
- **Decision:** Introduce a **Redis-backed job queue** using **BullMQ**.  
- **Reasoning:**  
  - Decouples order submission (API layer) from execution (worker layer).  
  - Prevents blocking I/O operations on API requests.  
  - Enables horizontal scaling by adding more worker processes.  
  - Reflects real-world DEX backends, which often rely on message queues or job brokers.

---

### 3. **Mock DEX Routing Logic**
- **Decision:** Implement two mock DEX services — *Raydium* and *Meteora* — that generate random quotes (price and fee).  
- **Reasoning:**  
  - Simulates real exchange routing logic.  
  - Allows experimentation with pricing strategies, slippage, and latency without external dependencies.  
  - Provides a testable environment for order routing algorithms.

---

### 4. **WebSocket for Real-Time Status**
- **Decision:** Use WebSocket for streaming order status updates.  
- **Reasoning:**  
  - Provides instant feedback to users on order lifecycle events (pending → routing → submitted → confirmed).  
  - Mimics modern trading APIs that use WebSocket or Webhook subscriptions.  
  - Eliminates the need for clients to poll the API repeatedly.

---

### 5. **PostgreSQL for Persistence**
- **Decision:** Use PostgreSQL to store order data and history.  
- **Reasoning:**  
  - Offers relational integrity and JSONB support for flexible data storage.  
  - Transaction safety ensures order history and states are always consistent.  
  - Ideal for analytics and replaying historical executions.

---

### 6. **Dockerized Environment**
- **Decision:** Package the entire system using Docker.  
- **Reasoning:**  
  - Guarantees environment consistency across local and deployed environments.  
  - Simplifies setup for Postgres and Redis using Docker Compose.  
  - Makes the system easily deployable to platforms like Railway, Render, or Fly.io.

---

### 7. **Testing Strategy**
- **Decision:** Use **Vitest** for unit testing and **Supertest** for integration testing.  
- **Reasoning:**  
  - Vitest offers fast TypeScript-compatible testing with built-in mocks.  
  - Supertest allows API-level testing without manual HTTP calls.  
  - Promotes maintainable, regression-free code through automated tests.

---

## 🏗️ Architecture Overview

```mermaid
flowchart LR
    A[Client / Frontend] -->|Submit Order| B[Fastify API]
    B -->|Enqueue Order| C[Redis Queue (BullMQ)]
    C -->|Process Job| D[Worker]
    D -->|Select Best DEX| E[Mock DEXs: Raydium / Meteora]
    D -->|Update| F[(PostgreSQL DB)]
    D -->|Broadcast Status| G[WebSocket Server]
    G -->|Real-Time Updates| A

##🧩 Components
Component	Responsibility
API Layer	Receives order requests and enqueues them
Queue (BullMQ)	Holds pending orders for workers
Worker	Executes routing and simulates swap
WebSocket Server	Sends live status updates to clients
PostgreSQL	Stores orders and status history

##🧪 Data Model
```orders Table
Stores primary order information.

Column	Type	Description
id	UUID	Unique identifier
status	TEXT	Current order status
token_in	TEXT	Input token (e.g., SOL)
token_out	TEXT	Output token (e.g., USDC)
amount	NUMERIC	Swap amount
slippage_bps	INTEGER	Max slippage tolerance
failure_reason	TEXT	Reason for failure
created_at	TIMESTAMP	Creation time
updated_at	TIMESTAMP	Last update time

order_status_history Table
Stores logs for every order state change.

Column	Type	Description
id	SERIAL	Log ID
order_id	UUID	Reference to order
status	TEXT	Status at this log
payload	JSONB	Metadata for event
created_at	TIMESTAMP	When logged```

## Local Setup
```Prerequisites
Node.js 20+

Docker Desktop

Postgres & Redis containers

Steps


git clone https://github.com/mrid07/OrderExecutionEngine_EternaLabsAssignment.git
cd order-execution-engine
docker compose up -d
npm install
npm run dev
Expected output:



[PG] Connected as oee@127.0.0.1:5433/oee
[MIGRATE] Done
[WORKER] Started
Server listening on http://localhost:3000```
##🌐 Testing the API
Create an order:



curl -X POST http://localhost:3000/api/orders/execute \
-H "Content-Type: application/json" \
-d '{"type":"market","tokenIn":"SOL","tokenOut":"USDC","amount":1,"slippageBps":100}'
WebSocket updates:



ws://localhost:3000/api/orders/execute?orderId=<orderId>
##🧪 Testing
arduino

npm test          # run all tests
npm run test:unit # run unit tests
npm run test:int  # run integration tests

Example Docker commands:

docker build -t order-execution-engine .
docker run -p 3000:3000 order-execution-engine
## Summary of Key Design Choices
Decision	Reason
Fastify + TypeScript	Lightweight, fast, and strongly typed
BullMQ Queue	Async, scalable, and production-grade
Redis	Reliable, low-latency in-memory broker
WebSocket	Real-time order tracking
PostgreSQL	Strong consistency and JSONB flexibility
Docker	Simplified deployment
Vitest + Supertest	Reliable automated testing

## Author
Mridul (mrid07)
Eterna Labs Assignment Project
GitHub: mrid07

---
