// test.js
import assert from 'assert';
import { queue, enqueue, parseAwards, serializeAwards, updateAwards } from './awards.js';
import { handleRedeemCommand, handleShoutoutCommand } from './bot.js';

function makeMockChannel(initialTopic) {
  let topic = initialTopic || '';
  return {
    get topic() {
      return topic;
    },
    async setTopic(newTopic) {
      topic = newTopic;
      return topic; // mimic Discord.js API (returns updated channel)
    }
  };
}

(async () => {
  // Test adding awards
  const channel = makeMockChannel('');
  const mockInteraction = {
    options: {
      getUser: name => ({ toString: () => "@user3" }),
      getInteger: name => 2,
      getString: name => "for being awesome"
    },
    reply: msg => console.log("Bot reply:", msg),
    channel,
    user: { toString: () => "@user1" }
  };

  await updateAwards(channel, '123', 5);
  assert.strictEqual(channel.topic, '<@123>🏆x5');

  // Test incrementing awards
  await updateAwards(channel, '123', 3);
  assert.strictEqual(channel.topic, '<@123>🏆x8');

  // Test negative check (should throw)
  try {
    await updateAwards(channel, '123', -10);
    assert.fail('Expected NegativeAwardError to be thrown');
  } catch (err) {
    assert.strictEqual(err.message, 'NegativeAwardError');
  }

  // Test awards for multiple users
  await updateAwards(channel, '456', 2);
  const parsed = await parseAwards(channel.topic);
  assert.strictEqual(parsed['123'], 8);
  assert.strictEqual(parsed['456'], 2);
  assert.strictEqual(serializeAwards(parsed), '<@123>🏆x8\n<@456>🏆x2')

  console.log('✅ All tests passed');
})();
