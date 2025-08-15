// test.mjs (ESM)
import assert from 'assert';
import { whenIdle, enqueue, updateAwards, parseAwards } from './awards.js';
import { handleShoutout, handleRedeem } from './bot.js'; // assumes you export these

function mockChannel(initial = '') {
  let topic = initial;
  return {
    get topic() { return topic; },
    async setTopic(t) { topic = t; return this; }
  };
}

function mockShoutout({ authorId = '111', to_whom, award_count, reason, channel }) {
  const replies = [];
  return {
    isChatInputCommand: () => true,
    commandName: 'shoutout',
    user: { id: authorId, toString: () => `<@${authorId}>` },
    options: {
      getUser: (name) => (name === 'to_whom' ? { id: to_whom, toString: () => `<@${to_whom}>` } : null),
      getInteger: (name) => (name === 'award_count' ? award_count : null),
      getString: (name) => (name === 'for' ? reason : null),
    },
    channel,
    reply: async (payload) => { replies.push(payload); },
    getReplies: () => replies
  };
}

function mockRedeem({ authorId = '111', for_whom, amount, channel }) {
  const replies = [];
  return {
    isChatInputCommand: () => true,
    commandName: 'redeem',
    user: { id: authorId, toString: () => `<@${authorId}>` },
    options: {
      getUser: (name) => (name === 'for_whom' ? { id: for_whom, toString: () => `<@${for_whom}>` } : null),
      getInteger: (name) => (name === 'amount' ? amount : null),
    },
    channel,
    reply: async (payload) => { replies.push(payload); },
    getReplies: () => replies
  };
}

(async () => {
  console.log('Running tests...');

  // 1) /shoutout
  {
    const channel = mockChannel('');
    const ix = mockShoutout({
      to_whom: '222',
      award_count: 3,
      reason: 'great job',
      channel
    });

    await handleShoutout(ix);
    await whenIdle(); // <- wait for queued updateAwards

    const parsed = parseAwards(channel.topic);
    assert.strictEqual(parsed.get('222'), 3, 'tally should be 3');
    const reply = ix.getReplies()[0];
    const content = typeof reply === 'string' ? reply : reply.content;
    assert.match(content, /🏆🏆🏆/);
    assert.match(content, /<@222>/);
  }

  // 2) /redeem success
  {
    const channel = mockChannel('<@222>🏆x5');
    const ix = mockRedeem({
      for_whom: '222',
      amount: 2,
      channel
    });

    await handleRedeem(ix);
    await whenIdle();

    const parsed = parseAwards(channel.topic);
    assert.strictEqual(parsed.get('222'), 3, 'tally should be 3 after redeem 2');
    const reply = ix.getReplies()[0];
    const content = typeof reply === 'string' ? reply : reply.content;
    assert.match(content, /redeemed/);
    assert.match(content, /🏆x2/);
  }

  // 3) /redeem negative failure
  {
    const channel = mockChannel('<@222>🏆x1');
    const ix = mockRedeem({
      for_whom: '222',
      amount: 5,
      channel
    });

    await handleRedeem(ix);
    await whenIdle();

    const reply = ix.getReplies()[0];
    const content = typeof reply === 'string' ? reply : reply.content;
    assert.match(content, /cannot redeem/i);
    const parsed = parseAwards(channel.topic);
    assert.strictEqual(parsed.get('222'), 1, 'tally should remain 1 on failure');
  }

  // 4) /redeem zero amount failure
  {
    const channel = mockChannel('<@222>🏆x1');
    const ix = mockRedeem({
      for_whom: '222',
      amount: 0,
      channel
    });

    await handleRedeem(ix);
    await whenIdle();

    const reply = ix.getReplies()[0];
    const content = typeof reply === 'string' ? reply : reply.content;
    assert.match(content, /cannot redeem/i);
    const parsed = parseAwards(channel.topic);
    assert.strictEqual(parsed.get('222'), 1, 'tally should remain 1 on failure');
  }

  console.log('✅ All tests passed');
})();
