// awards.js (ESM)
export const _queue = [];
let _processing = false;
let _idleWaiters = [];

// ---- Queue helpers ----
export function enqueue(taskFn) {
  // Returns a Promise that resolves/rejects when the job finishes
  return new Promise((resolve, reject) => {
    _queue.push(async () => {
      try {
        const r = await taskFn();
        resolve(r);
      } catch (e) {
        reject(e);
      }
    });
    processQueue();
  });
}

export async function processQueue() {
  if (_processing) return;
  _processing = true;

  while (_queue.length) {
    const job = _queue.shift();
    try { await job(); } catch (_) { /* already rejected in enqueue */ }
  }

  _processing = false;
  // wake any waiters
  if (_idleWaiters.length) {
    for (const wake of _idleWaiters) wake();
    _idleWaiters = [];
  }
}

export function whenIdle() {
  if (!_processing && _queue.length === 0) {
    return Promise.resolve();
  }
  // if (!_processing && _queue.length === 0) return Promise.resolve();
  return new Promise(res => _idleWaiters.push(res));
}

// ---- Awards logic ----
export function parseAwards(content='') {
  const m = new Map();
  if (!content) return m;
  const lines = content.trim().split("\n").slice(1); // skip "Leaderboard:"
  for (const line of lines) {
    const match = line.match(/^<@!?(\d+)>🏆x(\d+)$/);
    if (match) m.set(match[1], parseInt(match[2], 10));
  }
  return m;
}

export function serializeAwards(map) {
  const serialized = [...map.entries()]
    .map(([id, count]) => `<@${id}>🏆x${count}`)
    .join('\n');
  return "Leaderboard:\n" + serialized
}

export async function getOrCreateLeaderboardMessage(channel) {
  const pins = await channel.messages.fetchPinned();
  let leaderboardMsg = pins.find(m => m.content.startsWith("Leaderboard:"));

  if (!leaderboardMsg) {
    leaderboardMsg = await channel.send("Leaderboard:");
    await leaderboardMsg.pin();
  }
  return leaderboardMsg;
}

export async function updateAwards(channel, userId, delta) {
  const leaderboardMsg = await getOrCreateLeaderboardMessage(channel);
  const awards = parseAwards(leaderboardMsg.content);
  const next = (awards.get(userId) || 0) + delta;
  if (next < 0) throw new Error('NegativeAwardError');

  if (next === 0) awards.delete(userId); else awards.set(userId, next);
  const newContent = serializeAwards(awards);
  await leaderboardMsg.edit(newContent);
  return awards;
}
