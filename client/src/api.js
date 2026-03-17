const API_BASE = "";

let authPin = localStorage.getItem("spartan_pin") || "";

export function setPin(pin) {
  authPin = pin;
  localStorage.setItem("spartan_pin", pin);
}

export function getPin() {
  return authPin;
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-auth-pin": authPin,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Load full state
export async function loadState() {
  return api("GET", "/api/state");
}

// Save full state
export async function saveFullState(state) {
  return api("PUT", "/api/state", state);
}

// Save single day (fast, for real-time saves)
export async function saveDay(week, dayIndex, dayLog) {
  return api("PATCH", "/api/day", {
    week,
    day_index: dayIndex,
    checked: dayLog.ck || {},
    log_data: dayLog.lg || {},
    amrap_rounds: dayLog.ar || {},
  });
}

// Set current week
export async function setWeek(week) {
  return api("PUT", "/api/week", { week });
}

// Reset all data
export async function resetAll() {
  return api("DELETE", "/api/state");
}

// Seed initial data
export async function seedData(data) {
  return api("POST", "/api/seed", { data });
}
