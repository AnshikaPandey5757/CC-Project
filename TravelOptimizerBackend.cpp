#include <iostream>
#include <vector>
#include <queue>
#include <limits>
#include <algorithm>
#include <unordered_map>

using namespace std;

struct Edge {
    int to; // Graph index
    float distance;
};

int main() {
    // Optimize input/output operations
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int num_cities, num_roads;
    if (!(cin >> num_cities >> num_roads)) {
        cout << "STATUS: Error (Failed to read sizes)" << endl;
        return 1;
    }

    // Dynamic map to convert arbitrary City IDs (from JS frontend) into 0-based graph indices
    vector<int> cityIds(num_cities);
    unordered_map<int, int> idToIndex;
    unordered_map<int, int> indexToId;

    for (int i = 0; i < num_cities; ++i) {
        if (!(cin >> cityIds[i])) {
            cout << "STATUS: Error (Failed to read city ID)" << endl;
            return 1;
        }
        idToIndex[cityIds[i]] = i;
        indexToId[i] = cityIds[i];
    }

    // Read road connections
    vector<vector<Edge>> graph(num_cities);
    for (int i = 0; i < num_roads; ++i) {
        int uId, vId;
        float distVal;
        if (!(cin >> uId >> vId >> distVal)) {
            cout << "STATUS: Error (Failed to read road edge)" << endl;
            return 1;
        }

        // Map IDs to indices and add undirected edges
        if (idToIndex.find(uId) != idToIndex.end() && idToIndex.find(vId) != idToIndex.end()) {
            int u = idToIndex[uId];
            int v = idToIndex[vId];
            graph[u].push_back({v, distVal});
            graph[v].push_back({u, distVal});
        }
    }

    int startId, endId;
    if (!(cin >> startId >> endId)) {
        cout << "STATUS: Error (Failed to read start/end IDs)" << endl;
        return 1;
    }

    // Validate that start and end IDs exist in our graph mapping
    if (idToIndex.find(startId) == idToIndex.end() || idToIndex.find(endId) == idToIndex.end()) {
        cout << "STATUS: Error (Invalid start or end node)" << endl;
        return 0;
    }

    int startIdx = idToIndex[startId];
    int endIdx = idToIndex[endId];

    // Dijkstra Algorithm Setup
    vector<float> dist(num_cities, numeric_limits<float>::infinity());
    vector<int> prev(num_cities, -1);
    priority_queue<pair<float, int>, vector<pair<float, int>>, greater<>> pq;

    dist[startIdx] = 0.0f;
    pq.push({0.0f, startIdx});

    while (!pq.empty()) {
        int u = pq.top().second;
        pq.pop();

        if (u == endIdx) break; // Reached destination

        for (const auto &edge : graph[u]) {
            int v = edge.to;
            float weight = edge.distance;
            if (dist[u] + weight < dist[v]) {
                dist[v] = dist[u] + weight;
                prev[v] = u;
                pq.push({dist[v], v});
            }
        }
    }

    // Output Path Finding Outcome
    if (dist[endIdx] == numeric_limits<float>::infinity()) {
        cout << "STATUS: No Path Found" << endl;
        return 0;
    }

    // Reconstruct the node traversal path using back-tracking
    vector<int> path;
    for (int at = endIdx; at != -1; at = prev[at]) {
        path.push_back(indexToId[at]);
    }
    reverse(path.begin(), path.end());

    // Print result markers for Node.js parsing
    cout << "STATUS: Success" << endl;
    cout << "DISTANCE: " << dist[endIdx] << endl;
    cout << "PATH_SIZE: " << path.size() << endl;
    cout << "PATH:";
    for (int id : path) {
        cout << " " << id;
    }
    cout << endl;

    return 0;
}
