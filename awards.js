// awards.js

// In-memory queue
export const queue = [];
let processing = false;

export function enqueue(job) {
  queue.push(job);
  processQueue();
}

export async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    try {
      await job();
    } catch (err) {
      console.error('Job failed:', err);
    }
  }

  processing = false;
}

// Parse awards from channel topic
export function parseAwards(topic) {
  const awards = {};
  if (!topic) return awards;
  topic.split('\n').forEach(line => {
    const match = line.match(/^<@!?(\d+)>🏆x(\d+)$/);
    if (match) {
      const [, userId, count] = match;
      awards[userId] = parseInt(count, 10);
    }
  });
  return awards;
}

// Serialize awards to channel topic
export function serializeAwards(awards) {
  return Object.entries(awards)
    .map(([userId, count]) => `<@${userId}>🏆x${count}`)
    .join('\n');
}

// Update awards (mockable for tests)
export async function updateAwards(channel, userId, delta) {
  const awards = await parseAwards(channel.topic);

  awards[userId] = (awards[userId] || 0) + delta;
  if (awards[userId] <= 0)
    throw new Error('NegativeAwardError');

  await channel.setTopic(await serializeAwards(awards));
}
