import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync("worker/index.ts", "utf8");
const hub = fs.readFileSync("worker/realtime-hub.ts", "utf8");
const wrangler = fs.readFileSync("wrangler.jsonc", "utf8");
const realtime = fs.readFileSync("client/src/lib/realtime.ts", "utf8");
const api = fs.readFileSync("client/src/lib/api.ts", "utf8");
const auth = fs.readFileSync("client/src/contexts/AuthContext.tsx", "utf8");
const store = fs.readFileSync("client/src/lib/store.ts", "utf8");
const dashboard = fs.readFileSync("client/src/pages/Dashboard.tsx", "utf8");

assert.match(wrangler, /"REALTIME_HUB"/);
assert.match(wrangler, /"RadasaRealtimeHub"/);
assert.match(wrangler, /"new_sqlite_classes"\s*:\s*\["RadasaRealtimeHub"\]/);

assert.match(worker, /url\.pathname === "\/api\/realtime"/);
assert.match(worker, /jwt\.verify\(token, env\.JWT_SECRET\)/);
assert.match(worker, /ctx\.waitUntil\(/);
assert.match(worker, /broadcastMutation\(request, response, envBindings\)/);
assert.match(worker, /sourceClientId:\s*String\(request\.headers\.get\("X-Radasa-Client-Id"\)/);
assert.match(worker, /manifestos[\s\S]*?dashboard/);

assert.match(hub, /new WebSocketPair\(\)/);
assert.match(hub, /acceptWebSocket\(server\)/);
assert.match(hub, /getWebSockets\(\)/);
assert.match(hub, /socket\.send\(message\)/);

assert.match(api, /X-Radasa-Client-Id/);
assert.match(realtime, /new WebSocket\(websocketUrl\(\), \["radasa-sync", token\]\)/);
assert.match(realtime, /invalidateResourceCache\(resource\)/);
assert.match(realtime, /radasa-api-change:/);
assert.match(realtime, /sourceClientId === getRealtimeClientId\(\)/);
assert.match(realtime, /scheduleReconnect\(\)/);
assert.match(auth, /startRealtimeSync\(\)/);

assert.match(store, /activeRangeRef/);
assert.match(store, /void loadRange\(activeRange\.from, activeRange\.to\)/);
assert.match(dashboard, /REALTIME_CHANGE_EVENT/);
assert.match(dashboard, /realtimeChangeTouches\(event,"dashboard"\)/);

console.log("realtime multi-PC regression: ok");
