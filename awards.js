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
  if (!_processing && _queue.length === 0) return Promise.resolve();
  return new Promise(res => _idleWaiters.push(res));
}

// ---- Awards logic ----
export function parseAwards(topic = '') {
  const m = new Map();
  if (!topic) return m;
  for (const line of topic.split('\n')) {
    const match = line.match(/^<@!?(\d+)>🏆x(\d+)$/);
    if (match) m.set(match[1], parseInt(match[2], 10));
  }
  return m;
}

export function serializeAwards(map) {
  return Array.from(map.entries())
    .map(([id, count]) => `<@${id}>🏆x${count}`)
    .join('\n');
}

export async function updateAwards(channel, userId, delta) {
  const awards = parseAwards(channel.topic);
  if (delta < 0) {
    console.log('Delta:', delta);
  }
  const next = (awards.get(userId) || 0) + delta;
  if (next < 0) throw new Error('NegativeAwardError');

  if (next === 0) awards.delete(userId); else awards.set(userId, next);
  const newTopic = serializeAwards(awards);

  if (typeof channel.setTopic === 'function') {
    // wrap in a try-catch to handle potential errors
    try {
      await channel.setTopic(newTopic);
      if (delta < 0) {
        console.log('Done set topic:', newTopic);
      }
    } catch (err) {
      console.error(`Failed to update topic for channel ${channel.id}:`, err);
      throw err; // rethrow to let the caller handle it
    }
  } else {
    channel.topic = newTopic; // test fallback
  }
  return newTopic;
}
