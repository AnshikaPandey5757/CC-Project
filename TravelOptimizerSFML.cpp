#include <SFML/Graphics.hpp>
#include <iostream>
#include <vector>
#include <queue>
#include <cmath>
#include <limits>
#include <sstream>

using namespace std;
using namespace sf;

// ====== STRUCTURES ======
struct Edge {
    int to;
    float distance;
};

struct City {
    string name;
    Vector2f position;
};

// ====== DIJKSTRA FUNCTION ======
vector<int> dijkstra(int start, int goal, const vector<vector<Edge>>& graph, float &totalDist) {
    int n = graph.size();
    vector<float> dist(n, numeric_limits<float>::infinity());
    vector<int> prev(n, -1);
    priority_queue<pair<float, int>, vector<pair<float, int>>, greater<>> pq;

    dist[start] = 0;
    pq.push({0, start});

    while (!pq.empty()) {
        int u = pq.top().second;
        pq.pop();

        for (auto &edge : graph[u]) {
            int v = edge.to;
            float weight = edge.distance;
            if (dist[u] + weight < dist[v]) {
                dist[v] = dist[u] + weight;
                prev[v] = u;
                pq.push({dist[v], v});
            }
        }
    }

    totalDist = dist[goal];
    vector<int> path;
    for (int at = goal; at != -1; at = prev[at]) path.push_back(at);
    reverse(path.begin(), path.end());
    return path;
}

// ====== MAIN FUNCTION ======
int main() {
    int n;
    cout << "Enter number of cities: ";
    cin >> n;
    cin.ignore();

    vector<City> cities(n);
    vector<vector<Edge>> graph(n);

    // Input city names and positions
    for (int i = 0; i < n; ++i) {
        cout << "Enter name of city " << i << ": ";
        getline(cin, cities[i].name);
        cout << "Enter X and Y coordinates of city " << cities[i].name << ": ";
        cin >> cities[i].position.x >> cities[i].position.y;
        cin.ignore();
    }

    // Input edges
    cout << "Enter number of edges: ";
    int m;
    cin >> m;
    cin.ignore();

    cout << "Enter edges in format: city_index1 city_index2 distance\n";
    for (int i = 0; i < m; ++i) {
        int u, v;
        float d;
        cin >> u >> v >> d;
        cin.ignore();
        graph[u].push_back({v, d});
        graph[v].push_back({u, d}); // Assuming undirected graph
    }

    // Input start and end cities
    int startCity, endCity;
    while (true) {
        cout << "Enter start city index: ";
        cin >> startCity;
        if (startCity >= 0 && startCity < n) break;
        cout << "Invalid input.\n";
    }
    while (true) {
        cout << "Enter end city index: ";
        cin >> endCity;
        if (endCity >= 0 && endCity < n && endCity != startCity) break;
        cout << "Invalid input.\n";
    }

    float totalDist = 0.0f;
    vector<int> path = dijkstra(startCity, endCity, graph, totalDist);

    // SFML window
    RenderWindow window(VideoMode(1000, 700), "User-Based Travel Optimizer");
    window.setFramerateLimit(60);

    sf::Font font;
    if (!font.loadFromFile("Roboto_Condensed-Regular.ttf")) {
        cout << "Failed to load font!" << endl;
        return -1;
    }

    while (window.isOpen()) {
        Event event;
        while (window.pollEvent(event)) {
            if (event.type == Event::Closed)
                window.close();
        }

        window.clear(Color(25, 25, 35));

        // Draw all edges
        for (int i = 0; i < graph.size(); ++i) {
            for (auto &edge : graph[i]) {
                int j = edge.to;
                Vertex line[] = {
                    Vertex(cities[i].position, Color(90, 90, 110)),
                    Vertex(cities[j].position, Color(90, 90, 110))
                };
                window.draw(line, 2, Lines);
            }
        }

        // Highlight shortest path
        if (path.size() > 1) {
            for (size_t i = 0; i + 1 < path.size(); ++i) {
                Vertex line[] = {
                    Vertex(cities[path[i]].position, Color::Green),
                    Vertex(cities[path[i + 1]].position, Color::Green)
                };
                window.draw(line, 2, Lines);
            }
        }

        // Draw cities
        for (int i = 0; i < cities.size(); ++i) {
            CircleShape circle(25);
            circle.setOrigin(25, 25);
            circle.setPosition(cities[i].position);
            if (i == startCity)
                circle.setFillColor(Color::Blue);
            else if (i == endCity)
                circle.setFillColor(Color::Red);
            else
                circle.setFillColor(Color(180, 180, 200));
            window.draw(circle);

            Text nameText(cities[i].name, font, 18);
            nameText.setFillColor(Color::White);
            nameText.setPosition(cities[i].position.x - 10, cities[i].position.y - 10);
            window.draw(nameText);
        }

        // Display info
        Text info("", font, 20);
        stringstream ss;
        ss << "Start: " << cities[startCity].name
           << "  End: " << cities[endCity].name
           << "  | Distance: " << totalDist;
        info.setString(ss.str());
        info.setPosition(20, 650);
        info.setFillColor(Color::Cyan);
        window.draw(info);

        window.display();
    }

    return 0;
}

