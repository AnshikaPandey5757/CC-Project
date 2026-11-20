# 🌍 Travel Optimizer — Interactive Route Finder

> **A full-stack web application for visualizing and computing shortest paths between cities using Dijkstra's Algorithm — with a high-performance C++ backend and an interactive canvas-based UI.**

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [How It Works](#-how-it-works)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Screenshots](#-screenshots)
- [License](#-license)

---

## 🧭 Overview

**Travel Optimizer** is a Cloud Computing course project that demonstrates a hybrid architecture where a **JavaScript frontend** handles interactive graph visualization, while the computationally intensive **Dijkstra shortest-path algorithm** runs inside a compiled **C++ executable** spawned on-demand by a **Node.js server**.

Users can build custom city maps by dragging and connecting nodes on an HTML5 canvas, then instantly compute the optimal route between any two cities — with the shortest path animated visually on the graph.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗺️ **Interactive Canvas** | Drag, drop, add, and delete cities and roads on an HTML5 canvas |
| ⚡ **C++ Dijkstra Engine** | High-performance shortest path computation via a compiled C++ binary |
| 🛣️ **Dynamic Road Building** | Click two cities to draw roads with auto-calculated Euclidean distances |
| 📊 **Real-time Results** | Live status, total distance (km), and step-by-step optimal path display |
| 🌐 **Preset Maps** | Load pre-built maps: European Capitals, Structured Grid, Star Hub Network |
| 🎨 **Animated Visualization** | Shortest path is highlighted and animated with dashed line rendering |
| 🛠️ **Tool Palette** | Dedicated tools for Move, Add City, Add Road, and Delete operations |
| ✏️ **Edit Modal** | Double-click any city or road to rename it or adjust its weight |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend UI** | HTML5, CSS3, Vanilla JavaScript, HTML5 Canvas API |
| **Web Server** | Node.js (built-in `http` module — no frameworks) |
| **Algorithm Engine** | C++ (compiled to native `.exe` — Dijkstra with priority queue) |
| **Communication** | REST API (JSON over HTTP) between Node.js ↔ Browser |
| **IPC** | Node.js `child_process.spawn()` for Node.js ↔ C++ communication via `stdin`/`stdout` |
| **Fonts** | Google Fonts — Outfit & Space Grotesk |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Client)                  │
│  ┌─────────────────────────────────────────────┐   │
│  │   HTML5 Canvas  +  app.js  +  style.css     │   │
│  │   Interactive graph editor & visualization  │   │
│  └─────────────────┬───────────────────────────┘   │
│                    │  POST /api/optimize (JSON)     │
└────────────────────┼────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│               Node.js Server (server.js)            │
│  - Serves static files (HTML, CSS, JS)              │
│  - Handles POST /api/optimize endpoint              │
│  - Formats graph data as text → pipes to C++        │
│  - Parses C++ stdout response → returns JSON        │
└────────────────────┬────────────────────────────────┘
                     │  stdin/stdout (text protocol)
┌────────────────────▼────────────────────────────────┐
│          C++ Backend (TravelOptimizerBackend.exe)   │
│  - Reads graph data from stdin                      │
│  - Runs Dijkstra's Algorithm with min-heap PQ       │
│  - Outputs STATUS, DISTANCE, PATH to stdout         │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v14 or higher — [Download here](https://nodejs.org/)
- **Windows OS** (the C++ backend is pre-compiled as a `.exe`)
- A modern web browser (Chrome, Firefox, Edge)

> **Note:** No additional npm packages are required. The server uses only Node.js built-in modules.

### Installation & Running

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AnshikaPandey5757/CC-Project.git
   cd CC-Project
   ```

2. **Start the server:**
   ```bash
   node server.js
   ```

3. **Open the app in your browser:**
   ```
   http://localhost:3000
   ```

The server will start on port **3000** by default. You can override this with the `PORT` environment variable:
```bash
PORT=8080 node server.js
```

---

## ⚙️ How It Works

### 1. Frontend Graph Editor (`app.js`)
- Maintains an in-memory list of **cities** (nodes) and **roads** (edges)
- Renders the graph on an HTML5 `<canvas>` using the 2D Context API
- Handles all mouse interactions (drag, click, hover) for graph editing
- When start and end cities are selected, sends the full graph as JSON to the backend

### 2. Node.js Server (`server.js`)
- Acts as a **static file server** for the frontend assets
- Exposes a single REST endpoint: `POST /api/optimize`
- Formats the received city/road JSON into a simple **text protocol** for the C++ binary:
  ```
  <num_cities> <num_roads>
  <cityId1> <cityId2> ... <cityIdN>
  <fromId> <toId> <distance>
  ... (one line per road)
  <startId> <endId>
  ```
- Spawns `TravelOptimizerBackend.exe` as a child process and pipes the text to its `stdin`
- Reads the C++ output from `stdout` and parses it back to JSON for the client

### 3. C++ Dijkstra Engine (`TravelOptimizerBackend.cpp`)
- Reads the graph from `stdin`
- Uses an **`unordered_map`** to map arbitrary JS city IDs to 0-based graph indices
- Implements **Dijkstra's Algorithm** using C++'s `priority_queue` (min-heap) for optimal performance
- Outputs structured text to `stdout`:
  ```
  STATUS: Success
  DISTANCE: 1247
  PATH: 1 3 7 12
  ```

### Algorithm Complexity
| Metric | Value |
|---|---|
| **Time Complexity** | O((V + E) log V) |
| **Space Complexity** | O(V + E) |
| **Data Structure** | Min-heap Priority Queue |
| **Graph Type** | Undirected, Weighted |

---

## 📁 Project Structure

```
TravelOptimizer/
├── index.html                   # Main HTML page — layout & UI structure
├── style.css                    # Styling — glassmorphism UI, canvas layout
├── app.js                       # Frontend logic — canvas rendering, graph management, API calls
├── server.js                    # Node.js HTTP server — static files + /api/optimize endpoint
├── TravelOptimizerBackend.cpp   # C++ source — Dijkstra's algorithm implementation
├── TravelOptimizerBackend.exe   # Pre-compiled C++ binary (Windows x64)
└── README.md                    # This file
```

---

## 🌐 API Reference

### `POST /api/optimize`

Computes the shortest path between two cities using the C++ Dijkstra engine.

**Request Body (JSON):**
```json
{
  "cities": [
    { "id": 1 },
    { "id": 2 },
    { "id": 3 }
  ],
  "roads": [
    { "fromId": 1, "toId": 2, "distance": 150 },
    { "fromId": 2, "toId": 3, "distance": 200 }
  ],
  "startCityId": 1,
  "endCityId": 3
}
```

**Response — Success:**
```json
{
  "success": true,
  "distance": 350,
  "path": [1, 2, 3]
}
```

**Response — No Path:**
```json
{
  "success": false,
  "error": "No Path Found"
}
```

**Response — Error:**
```json
{
  "error": "Missing required parameters"
}
```

---

## 🗺️ Preset Maps

The app ships with 3 built-in preset maps you can load instantly:

| Preset | Description |
|---|---|
| 🇪🇺 **European Capitals** | Major European cities with realistic relative positions |
| 🔲 **Structured Grid** | A regular grid topology for testing structured shortest paths |
| ⭐ **Star Hub Network** | A hub-and-spoke topology — one central hub connected to outer cities |

---

## 🖱️ User Guide

| Action | How To |
|---|---|
| **Add a city** | Select the 📍 Add City tool, then click on the canvas |
| **Move a city** | Select the 🖐️ Move tool, then drag any city node |
| **Add a road** | Select the 🛣️ Add Road tool, click City A, then click City B |
| **Delete** | Select the ❌ Delete tool, then click any city or road |
| **Edit name** | Double-click a city node (in Move mode) to rename it |
| **Find shortest path** | Select Start and End cities from the sidebar dropdowns |
| **Reset path** | Click the **Reset Path** button in the sidebar |
| **Clear map** | Click **Clear All** or select **Clear Map (Custom)** from the preset dropdown |

---

## 👩‍💻 Author

**Anshika Pandey**
- GitHub: [@AnshikaPandey5757](https://github.com/AnshikaPandey5757)
- Repository: [CC-Project](https://github.com/AnshikaPandey5757/CC-Project)

---

## 📄 License

This project is developed as part of a **Cloud Computing course project**.

---

*Built with ❤️ using HTML5, CSS3, JavaScript, Node.js, and C++*
