/* ==========================================================================
   Travel Optimizer - Application State, Canvas UI & Graph Algorithms
   ========================================================================== */

// ------ State Variables ------
let cities = [];
let roads = [];
let startCityId = null;
let endCityId = null;
let activeTool = 'move'; // 'move', 'add-city', 'add-road', 'delete'

// Interaction helpers
let hoveredCityId = null;
let hoveredRoadId = null;
let selectedCityId = null;
let dragCityId = null;
let roadStartCityId = null; // Used in 'add-road' tool
let mousePos = { x: 0, y: 0 };
let dashOffset = 0;

// Modal handler
let modalCallback = null;

// ------ DOM Elements ------
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const canvasWrapper = canvas.parentElement;

const selectStart = document.getElementById('select-start');
const selectEnd = document.getElementById('select-end');
const routeStatus = document.getElementById('route-status');
const routeDistance = document.getElementById('route-distance');
const routePathContainer = document.getElementById('route-path');

const statCities = document.getElementById('stat-cities');
const statRoads = document.getElementById('stat-roads');
const helperToast = document.getElementById('canvas-helper');

const btnClear = document.getElementById('btn-clear');
const btnReset = document.getElementById('btn-reset');
const presetSelect = document.getElementById('preset-select');

const toolBtns = {
    'move': document.getElementById('tool-move'),
    'add-city': document.getElementById('tool-add-city'),
    'add-road': document.getElementById('tool-add-road'),
    'delete': document.getElementById('tool-delete')
};

// Modal DOM
const editModal = document.getElementById('edit-modal');
const modalTitle = document.getElementById('modal-title');
const modalFormFields = document.getElementById('modal-form-fields');
const modalCancel = document.getElementById('modal-cancel');
const modalSubmit = document.getElementById('modal-submit');

// ------ Initial Setup ------
window.addEventListener('resize', resizeCanvas);
setTimeout(resizeCanvas, 50); // small delay to ensure wrapper has dimensions

// Generate automatic city names
const PRESET_NAMES = [
    "Atherton", "Belmont", "Coronado", "Del Mar", "El Segundo", 
    "Fairfield", "Glendale", "Hillsborough", "Irwindale", "Jolon", 
    "Kingsburg", "Lafayette", "Mill Valley", "Novato", "Oakland", 
    "Pasadena", "Redlands", "Sausalito", "Tiburon", "Vallejo"
];

function getNextCityName() {
    // Find a name from PRESET_NAMES that isn't currently used
    const usedNames = new Set(cities.map(c => c.name));
    for (let name of PRESET_NAMES) {
        if (!usedNames.has(name)) return name;
    }
    // Fallback if we run out of presets
    return `City ${cities.length + 1}`;
}

// ------ Canvas Resize ------
function resizeCanvas() {
    const rect = canvasWrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // If empty load default preset
    if (cities.length === 0) {
        loadPreset('europe');
    } else {
        draw();
    }
}

// ------ Canvas Coordinates Helper ------
function getMouseCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

// ------ Distance calculator ------
function getDistance(x1, y1, x2, y2) {
    return Math.round(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2));
}

// ------ Dijkstra Algorithm ------
async function runDijkstra() {
    if (startCityId === null || endCityId === null) {
        updateResultsUI(null, "Select Start/End");
        return;
    }
    
    if (startCityId === endCityId) {
        updateResultsUI({ path: [startCityId], pathRoads: [], distance: 0 }, "Same City");
        return;
    }

    updateResultsUI(null, "Calculating route...");

    try {
        const response = await fetch('/api/optimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cities: cities.map(c => ({ id: c.id })),
                roads: roads.map(r => ({ fromId: r.fromId, toId: r.toId, distance: r.distance })),
                startCityId,
                endCityId
            })
        });

        const result = await response.json();

        if (result.success) {
            const path = result.path;
            const pathRoads = [];

            // Reconstruct the visual road paths from the list of city node IDs returned by C++
            for (let i = 0; i < path.length - 1; i++) {
                const u = path[i];
                const v = path[i + 1];
                const road = roads.find(r => 
                    (r.fromId === u && r.toId === v) || 
                    (r.fromId === v && r.toId === u)
                );
                if (road) {
                    pathRoads.push(road.id);
                }
            }

            updateResultsUI({ path, pathRoads, distance: result.distance }, "Optimal Route Found (via C++ Backend)");
        } else {
            updateResultsUI(null, result.error || "Route Computation Failed");
        }
    } catch (err) {
        console.error("Backend connection error:", err);
        updateResultsUI(null, "Connection to C++ Server Lost");
    }
    draw();
}

// ------ Update Stats & Results ------
let activePathResult = null;

function updateResultsUI(result, statusMsg) {
    activePathResult = result;
    
    // Update labels
    routeStatus.textContent = statusMsg;
    if (result && result.distance !== Infinity) {
        routeStatus.className = "result-value status-found";
        routeDistance.textContent = `${result.distance} km`;
        
        // Populate path list elements
        routePathContainer.innerHTML = '';
        result.path.forEach((cityId, index) => {
            const city = cities.find(c => c.id === cityId);
            if (!city) return;
            
            const nodeSpan = document.createElement('span');
            nodeSpan.textContent = city.name;
            nodeSpan.classList.add('path-node');
            if (cityId === startCityId) nodeSpan.classList.add('start');
            else if (cityId === endCityId) nodeSpan.classList.add('end');
            
            routePathContainer.appendChild(nodeSpan);
            
            if (index < result.path.length - 1) {
                const arrow = document.createElement('span');
                arrow.innerHTML = ' ➔ ';
                arrow.classList.add('path-arrow');
                routePathContainer.appendChild(arrow);
            }
        });
    } else {
        routeStatus.className = result === null && statusMsg.includes("Select") ? "result-value status-searching" : "result-value status-none";
        routeDistance.textContent = "-";
        routePathContainer.innerHTML = '<span class="placeholder-text">No active path</span>';
    }
    
    // Stats update
    statCities.textContent = `${cities.length} Cities`;
    statRoads.textContent = `${roads.length} Roads`;
}

// ------ Repopulate Start / End Selectors ------
function updateSelectors() {
    const prevStart = startCityId;
    const prevEnd = endCityId;

    selectStart.innerHTML = '<option value="">-- Choose Start --</option>';
    selectEnd.innerHTML = '<option value="">-- Choose End --</option>';

    // Sort cities alphabetically for user lists
    const sortedCities = [...cities].sort((a, b) => a.name.localeCompare(b.name));

    sortedCities.forEach(city => {
        const startOpt = document.createElement('option');
        startOpt.value = city.id;
        startOpt.textContent = city.name;
        selectStart.appendChild(startOpt);

        const endOpt = document.createElement('option');
        endOpt.value = city.id;
        endOpt.textContent = city.name;
        selectEnd.appendChild(endOpt);
    });

    // Restore previous choices if still valid
    if (cities.some(c => c.id === prevStart)) {
        startCityId = prevStart;
        selectStart.value = prevStart;
    } else {
        startCityId = null;
    }

    if (cities.some(c => c.id === prevEnd)) {
        endCityId = prevEnd;
        selectEnd.value = prevEnd;
    } else {
        endCityId = null;
    }
}

// ------ UI Selectors Events ------
selectStart.addEventListener('change', (e) => {
    startCityId = e.target.value ? parseInt(e.target.value) : null;
    runDijkstra();
    draw();
});

selectEnd.addEventListener('change', (e) => {
    endCityId = e.target.value ? parseInt(e.target.value) : null;
    runDijkstra();
    draw();
});

// ------ Tool Controls ------
Object.keys(toolBtns).forEach(tool => {
    toolBtns[tool].addEventListener('click', () => {
        // Toggle active button class
        Object.values(toolBtns).forEach(btn => btn.classList.remove('active'));
        toolBtns[tool].classList.add('active');
        activeTool = tool;

        // Reset state
        roadStartCityId = null;
        selectedCityId = null;
        
        // Toast help text
        updateHelperToast();
        draw();
    });
});

function updateHelperToast() {
    switch (activeTool) {
        case 'move':
            helperToast.textContent = "🖐️ Drag a city to move it. Double click to edit name/weight.";
            break;
        case 'add-city':
            helperToast.textContent = "📍 Click empty canvas space to add a city.";
            break;
        case 'add-road':
            helperToast.textContent = "🛣️ Click start city, then click destination city to connect.";
            break;
        case 'delete':
            helperToast.textContent = "❌ Click on a city or road line to delete it.";
            break;
    }
}

// ------ Modal Overlay Helper ------
function openModal(title, formHTML, onSave) {
    modalTitle.textContent = title;
    modalFormFields.innerHTML = formHTML;
    editModal.classList.remove('hidden');
    
    // Focus first input
    const firstInput = modalFormFields.querySelector('input');
    if (firstInput) {
        firstInput.focus();
        firstInput.select();
    }
    
    modalCallback = onSave;
}

function closeModal() {
    editModal.classList.add('hidden');
    modalCallback = null;
}

modalCancel.addEventListener('click', closeModal);
modalSubmit.addEventListener('click', () => {
    if (modalCallback) {
        modalCallback();
    }
    closeModal();
});

// Allow Enter key to submit modal
editModal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        modalSubmit.click();
    } else if (e.key === 'Escape') {
        modalCancel.click();
    }
});

// ------ Interactive Map Logic ------

// Get City under coordinates
function getCityAt(x, y) {
    const clickRadius = 22; // close enough to city
    return cities.find(city => getDistance(city.x, city.y, x, y) < clickRadius);
}

// Get Road under coordinates
function getRoadAt(x, y) {
    const threshold = 8;
    for (let r of roads) {
        const c1 = cities.find(c => c.id === r.fromId);
        const c2 = cities.find(c => c.id === r.toId);
        if (!c1 || !c2) continue;

        // Calculate distance from point (x,y) to line segment c1 -> c2
        const A = x - c1.x;
        const B = y - c1.y;
        const C = c2.x - c1.x;
        const D = c2.y - c1.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;
        if (param < 0) {
            xx = c1.x;
            yy = c1.y;
        } else if (param > 1) {
            xx = c2.x;
            yy = c2.y;
        } else {
            xx = c1.x + param * C;
            yy = c1.y + param * D;
        }

        const dist = getDistance(x, y, xx, yy);
        if (dist < threshold) {
            return r;
        }
    }
    return null;
}

// Canvas Mouse Handlers
canvas.addEventListener('mousedown', (e) => {
    const pos = getMouseCoordinates(e);
    const clickedCity = getCityAt(pos.x, pos.y);

    if (activeTool === 'move') {
        if (clickedCity) {
            dragCityId = clickedCity.id;
            selectedCityId = clickedCity.id;
        } else {
            const clickedRoad = getRoadAt(pos.x, pos.y);
            if (clickedRoad) {
                // Select road
                hoveredRoadId = clickedRoad.id;
            }
        }
    } else if (activeTool === 'add-city') {
        if (!clickedCity) {
            // Add new city
            const newName = getNextCityName();
            const formHTML = `
                <div class="form-group">
                    <label for="city-name-input">City Name:</label>
                    <input type="text" id="city-name-input" value="${newName}">
                </div>
            `;
            openModal("Add City", formHTML, () => {
                const nameInput = document.getElementById('city-name-input').value.trim();
                const finalName = nameInput || newName;
                const newId = cities.length ? Math.max(...cities.map(c => c.id)) + 1 : 1;
                cities.push({
                    id: newId,
                    name: finalName,
                    x: pos.x,
                    y: pos.y
                });
                updateSelectors();
                runDijkstra();
                draw();
            });
        }
    } else if (activeTool === 'add-road') {
        if (clickedCity) {
            if (roadStartCityId === null) {
                roadStartCityId = clickedCity.id;
            } else {
                // Second city selected
                const startId = roadStartCityId;
                const endId = clickedCity.id;
                roadStartCityId = null; // reset

                if (startId === endId) return;

                // Check if road already exists
                const roadExists = roads.some(r => 
                    (r.fromId === startId && r.toId === endId) || 
                    (r.fromId === endId && r.toId === startId)
                );

                if (!roadExists) {
                    const c1 = cities.find(c => c.id === startId);
                    const c2 = cities.find(c => c.id === endId);
                    const defaultDist = getDistance(c1.x, c1.y, c2.x, c2.y);
                    
                    const formHTML = `
                        <div class="form-group">
                            <label for="road-dist-input">Distance / Weight (km):</label>
                            <input type="number" id="road-dist-input" value="${defaultDist}" min="1">
                        </div>
                    `;
                    openModal("Connect Cities", formHTML, () => {
                        const distVal = parseInt(document.getElementById('road-dist-input').value) || defaultDist;
                        const roadId = roads.length ? Math.max(...roads.map(r => r.id)) + 1 : 1;
                        roads.push({
                            id: roadId,
                            fromId: startId,
                            toId: endId,
                            distance: distVal
                        });
                        runDijkstra();
                        draw();
                    });
                }
            }
        } else {
            // clicked empty space, cancel edge drawing
            roadStartCityId = null;
        }
    } else if (activeTool === 'delete') {
        if (clickedCity) {
            // Delete City
            cities = cities.filter(c => c.id !== clickedCity.id);
            // Delete connected roads
            roads = roads.filter(r => r.fromId !== clickedCity.id && r.toId !== clickedCity.id);
            // Reset start/end
            if (startCityId === clickedCity.id) startCityId = null;
            if (endCityId === clickedCity.id) endCityId = null;
            updateSelectors();
            runDijkstra();
        } else {
            // Try deleting road
            const clickedRoad = getRoadAt(pos.x, pos.y);
            if (clickedRoad) {
                roads = roads.filter(r => r.id !== clickedRoad.id);
                runDijkstra();
            }
        }
    }
    draw();
});

canvas.addEventListener('mousemove', (e) => {
    const pos = getMouseCoordinates(e);
    mousePos = pos;

    if (dragCityId !== null) {
        const city = cities.find(c => c.id === dragCityId);
        if (city) {
            // Drag and update coordinates
            city.x = Math.max(25, Math.min(canvas.width - 25, pos.x));
            city.y = Math.max(25, Math.min(canvas.height - 25, pos.y));
            runDijkstra();
        }
    } else {
        // Track hover elements
        const hoverCity = getCityAt(pos.x, pos.y);
        hoveredCityId = hoverCity ? hoverCity.id : null;

        if (!hoveredCityId) {
            const hoverRoad = getRoadAt(pos.x, pos.y);
            hoveredRoadId = hoverRoad ? hoverRoad.id : null;
        } else {
            hoveredRoadId = null;
        }
    }
    draw();
});

canvas.addEventListener('mouseup', () => {
    dragCityId = null;
    draw();
});

// Double click shortcut: Edit Name/Weight
canvas.addEventListener('dblclick', (e) => {
    const pos = getMouseCoordinates(e);
    const clickedCity = getCityAt(pos.x, pos.y);
    
    if (clickedCity) {
        // Double clicked city -> rename
        const formHTML = `
            <div class="form-group">
                <label for="city-rename-input">Rename City:</label>
                <input type="text" id="city-rename-input" value="${clickedCity.name}">
            </div>
        `;
        openModal("Rename City", formHTML, () => {
            const newName = document.getElementById('city-rename-input').value.trim();
            if (newName) {
                clickedCity.name = newName;
                updateSelectors();
                runDijkstra();
                draw();
            }
        });
    } else {
        const clickedRoad = getRoadAt(pos.x, pos.y);
        if (clickedRoad) {
            // Double clicked road -> edit distance weight
            const formHTML = `
                <div class="form-group">
                    <label for="road-weight-input">Edit Weight (km):</label>
                    <input type="number" id="road-weight-input" value="${clickedRoad.distance}" min="1">
                </div>
            `;
            openModal("Edit Connection Weight", formHTML, () => {
                const newDist = parseInt(document.getElementById('road-weight-input').value);
                if (newDist && newDist > 0) {
                    clickedRoad.distance = newDist;
                    runDijkstra();
                    draw();
                }
            });
        } else {
            // Double click empty space: quick-add city
            const newName = getNextCityName();
            const newId = cities.length ? Math.max(...cities.map(c => c.id)) + 1 : 1;
            cities.push({
                id: newId,
                name: newName,
                x: pos.x,
                y: pos.y
            });
            updateSelectors();
            runDijkstra();
            draw();
        }
    }
});

// ------ Preset Loader Logic ------
function loadPreset(presetName) {
    cities = [];
    roads = [];
    startCityId = null;
    endCityId = null;
    roadStartCityId = null;
    activePathResult = null;

    const width = canvas.width || 800;
    const height = canvas.height || 600;

    if (presetName === 'europe') {
        // European Cities layout scaled to canvas
        cities = [
            { id: 1, name: "London", x: Math.round(width * 0.18), y: Math.round(height * 0.28) },
            { id: 2, name: "Paris", x: Math.round(width * 0.22), y: Math.round(height * 0.48) },
            { id: 3, name: "Brussels", x: Math.round(width * 0.32), y: Math.round(height * 0.38) },
            { id: 4, name: "Berlin", x: Math.round(width * 0.52), y: Math.round(height * 0.32) },
            { id: 5, name: "Munich", x: Math.round(width * 0.50), y: Math.round(height * 0.55) },
            { id: 6, name: "Vienna", x: Math.round(width * 0.68), y: Math.round(height * 0.58) },
            { id: 7, name: "Rome", x: Math.round(width * 0.58), y: Math.round(height * 0.82) },
            { id: 8, name: "Madrid", x: Math.round(width * 0.08), y: Math.round(height * 0.78) }
        ];

        roads = [
            { id: 1, fromId: 1, toId: 2, distance: 340 },  // London - Paris
            { id: 2, fromId: 1, toId: 3, distance: 320 },  // London - Brussels
            { id: 3, fromId: 2, toId: 3, distance: 300 },  // Paris - Brussels
            { id: 4, fromId: 2, toId: 8, distance: 1250 }, // Paris - Madrid
            { id: 5, fromId: 3, toId: 4, distance: 760 },  // Brussels - Berlin
            { id: 6, fromId: 4, toId: 5, distance: 580 },  // Berlin - Munich
            { id: 7, fromId: 5, toId: 6, distance: 400 },  // Munich - Vienna
            { id: 8, fromId: 6, toId: 7, distance: 1100 }, // Vienna - Rome
            { id: 9, fromId: 5, toId: 7, distance: 920 },  // Munich - Rome
            { id: 10, fromId: 2, toId: 5, distance: 840 }  // Paris - Munich
        ];

        startCityId = 1; // London
        endCityId = 7;   // Rome
    } 
    else if (presetName === 'grid') {
        // Structured 3x3 Grid
        const stepX = width * 0.22;
        const stepY = height * 0.22;
        const startX = width * 0.28;
        const startY = height * 0.28;

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const id = row * 3 + col + 1;
                cities.push({
                    id: id,
                    name: `Node-${String.fromCharCode(65 + row)}${col + 1}`,
                    x: Math.round(startX + col * stepX),
                    y: Math.round(startY + row * stepY)
                });
            }
        }

        // Add grid connections
        let roadId = 1;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const currId = row * 3 + col + 1;
                
                // Connection to right
                if (col < 2) {
                    roads.push({ id: roadId++, fromId: currId, toId: currId + 1, distance: 100 });
                }
                // Connection to bottom
                if (row < 2) {
                    roads.push({ id: roadId++, fromId: currId, toId: currId + 3, distance: 100 });
                }
                // Diagonal connection (shortcut)
                if (row < 2 && col < 2) {
                    roads.push({ id: roadId++, fromId: currId, toId: currId + 4, distance: 140 });
                }
            }
        }

        startCityId = 1; // Node A1
        endCityId = 9;   // Node C3
    }
    else if (presetName === 'star') {
        const centerX = Math.round(width * 0.5);
        const centerY = Math.round(height * 0.5);
        const radius = Math.min(width, height) * 0.3;

        cities.push({ id: 1, name: "Central Hub", x: centerX, y: centerY });
        
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3; // 6 outer cities
            cities.push({
                id: i + 2,
                name: `Spoke Node ${i + 1}`,
                x: Math.round(centerX + Math.cos(angle) * radius),
                y: Math.round(centerY + Math.sin(angle) * radius)
            });
        }

        let roadId = 1;
        for (let i = 0; i < 6; i++) {
            // Connected to Hub
            roads.push({ id: roadId++, fromId: 1, toId: i + 2, distance: 200 });
            // Connected to adjacent Spoke (Ring)
            const nextIdx = (i + 1) % 6;
            roads.push({ id: roadId++, fromId: i + 2, toId: nextIdx + 2, distance: 150 });
        }

        startCityId = 2; // Spoke 1
        endCityId = 5;   // Spoke 4
    }

    updateSelectors();
    runDijkstra();
    draw();
}

presetSelect.addEventListener('change', (e) => {
    loadPreset(e.target.value);
});

// Clear / Reset Paths
btnClear.addEventListener('click', () => {
    cities = [];
    roads = [];
    startCityId = null;
    endCityId = null;
    roadStartCityId = null;
    activePathResult = null;
    presetSelect.value = 'empty';
    updateSelectors();
    runDijkstra();
    draw();
});

btnReset.addEventListener('click', () => {
    startCityId = null;
    endCityId = null;
    roadStartCityId = null;
    updateSelectors();
    runDijkstra();
    draw();
});

// ------ Animation / Draw Loop ------
function animate() {
    dashOffset = (dashOffset - 0.4) % 30; // Move dashes along shortest path
    draw();
    requestAnimationFrame(animate);
}

// Start animation loop
requestAnimationFrame(animate);

// ------ Draw Canvas ------
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Draw Background Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    
    for (let x = 0; x < canvas.width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // 2. Draw Road Connections
    roads.forEach(road => {
        const fromCity = cities.find(c => c.id === road.fromId);
        const toCity = cities.find(c => c.id === road.toId);
        if (!fromCity || !toCity) return;

        const isPartOfPath = activePathResult && activePathResult.pathRoads && activePathResult.pathRoads.includes(road.id);

        if (isPartOfPath) {
            // Draw Glow underlay
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(fromCity.x, fromCity.y);
            ctx.lineTo(toCity.x, toCity.y);
            ctx.stroke();

            // Draw Core active line
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(fromCity.x, fromCity.y);
            ctx.lineTo(toCity.x, toCity.y);
            ctx.stroke();

            // Animated marching dash lines along path direction
            ctx.save();
            ctx.strokeStyle = '#a7f3d0';
            ctx.lineWidth = 3.5;
            ctx.lineDashOffset = dashOffset;
            ctx.setLineDash([12, 18]);
            ctx.beginPath();
            ctx.moveTo(fromCity.x, fromCity.y);
            ctx.lineTo(toCity.x, toCity.y);
            ctx.stroke();
            ctx.restore();
        } else {
            // Normal connection
            const isHovered = (hoveredRoadId === road.id);
            ctx.strokeStyle = isHovered ? '#00f0ff' : 'rgba(148, 163, 184, 0.25)';
            ctx.lineWidth = isHovered ? 2.5 : 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(fromCity.x, fromCity.y);
            ctx.lineTo(toCity.x, toCity.y);
            ctx.stroke();
        }

        // Draw Road Distance weight tags
        drawWeightTag(fromCity.x, fromCity.y, toCity.x, toCity.y, road.distance, isPartOfPath);
    });

    // 3. Draw Active Road placement line (if user is dragging a road)
    if (activeTool === 'add-road' && roadStartCityId !== null) {
        const startCity = cities.find(c => c.id === roadStartCityId);
        if (startCity) {
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(startCity.x, startCity.y);
            ctx.lineTo(mousePos.x, mousePos.y);
            ctx.stroke();
            ctx.setLineDash([]); // reset
        }
    }

    // 4. Draw Cities
    cities.forEach(city => {
        const isStart = (city.id === startCityId);
        const isEnd = (city.id === endCityId);
        const isHovered = (city.id === hoveredCityId);
        const isSelected = (city.id === selectedCityId);

        // Core fill colors
        let fill = '#334155'; // default slate grey
        let border = '#64748b';
        let glowColor = null;

        if (isStart) {
            fill = '#3b82f6';
            border = '#93c5fd';
            glowColor = 'rgba(59, 130, 246, 0.4)';
        } else if (isEnd) {
            fill = '#ef4444';
            border = '#fca5a5';
            glowColor = 'rgba(239, 68, 68, 0.4)';
        } else if (isHovered || isSelected) {
            fill = '#1e293b';
            border = '#00f0ff';
            glowColor = 'rgba(0, 240, 255, 0.25)';
        }

        const radius = (isStart || isEnd) ? 18 : 15;

        // Draw Glow Ring
        if (glowColor) {
            ctx.shadowColor = border;
            ctx.shadowBlur = isHovered ? 12 : 8;
            ctx.fillStyle = glowColor;
            ctx.beginPath();
            ctx.arc(city.x, city.y, radius + 5, 0, Math.PI * 2);
            ctx.fill();
            // Clear shadow settings
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }

        // Draw Outer Border
        ctx.fillStyle = border;
        ctx.beginPath();
        ctx.arc(city.x, city.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw Inner Center
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(city.x, city.y, radius - 3, 0, Math.PI * 2);
        ctx.fill();

        // Draw Node Dots if Start/End
        if (isStart || isEnd) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(city.x, city.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw City Name Text
        ctx.font = 'bold 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        
        // Draw shadow box behind name text
        const textWidth = ctx.measureText(city.name).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.beginPath();
        ctx.roundRect(city.x - textWidth / 2 - 6, city.y - radius - 24, textWidth + 12, 18, 4);
        ctx.fill();
        
        // Label border
        ctx.strokeStyle = isHovered ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(city.x - textWidth / 2 - 6, city.y - radius - 24, textWidth + 12, 18, 4);
        ctx.stroke();

        // Label string
        ctx.fillStyle = isHovered ? '#00f0ff' : '#f8fafc';
        ctx.fillText(city.name, city.x, city.y - radius - 11);
    });
}

// Drawing helper for weights centered on road lines
function drawWeightTag(x1, y1, x2, y2, weight, isHighlighted) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const label = `${weight} km`;
    ctx.font = '500 10.5px Space Grotesk, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const height = 15;

    // Background pill shape
    ctx.fillStyle = 'rgba(11, 12, 16, 0.9)';
    ctx.strokeStyle = isHighlighted ? '#10b981' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.roundRect(midX - textWidth / 2 - 4, midY - height / 2, textWidth + 8, height, 4);
    ctx.fill();
    ctx.stroke();

    // Value Text
    ctx.fillStyle = isHighlighted ? '#10b981' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, midX, midY + 0.5);
    ctx.textBaseline = 'alphabetic'; // reset
}
