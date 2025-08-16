// test.mjs
import assert from 'assert';
import test from 'node:test';
import { whenIdle, parseAwards } from './awards.js';
import { handleShoutout, handleRedeem } from './bot.js';

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

test.describe('/shoutout', () => {
  test('should award points', async () => {
    const channel = mockChannel('');
    const ix = mockShoutout({
      to_whom: '222',
      award_count: 3,
      reason: 'great job',
      channel
    });

    await handleShoutout(ix);
    await whenIdle();

    const parsed = parseAwards(channel.topic);
    assert.strictEqual(parsed.get('222'), 3);
    const reply = ix.getReplies()[0];
    const content = typeof reply === 'string' ? reply : reply.content;
    assert.match(content, /🏆🏆🏆/);
    assert.match(content, /<@222>/);
  });
});

test.describe('/shoutout', () => {
  test('should not award oneself', async () => {
    const channel = mockChannel('');
    const ix = mockShoutout({
      to_whom: '111',
      award_count: 3,
      reason: 'great job',
      channel
    });

    await handleShoutout(ix);
    await whenIdle();

    const reply = ix.getReplies()[0];
    const content = typeof reply === 'string' ? reply : reply.content;
    assert.match(content, /cannot give awards to yourself/);
  });
});

test.describe('/redeem', () => {
  test('should redeem points successfully', async () => {
    const channel = mockChannel('<@222>🏆x5');
    const ix = mockRedeem({
      for_whom: '222',
      amount: 2,
      channel
    });

    await handleRedeem(ix);
    await whenIdle();

    const parsed = parseAwards(channel.topic);
    assert.strictEqual(parsed.get('222'), 3);
    const reply = ix.getReplies()[0];
    const content = typeof reply === 'string' ? reply : reply.content;
    assert.match(content, /redeemed/);
    assert.match(content, /🏆x2/);
  });

  test('should fail if redeeming more than available', async () => {
    const channel = mockChannel('<@222>🏆x1');
    const ix = mockRedeem({
      for_whom: '222',
      amount: 5,
      channel
    });

    await handleRedeem(ix);
    await whenIdle();

    const parsed = parseAwards(channel.topic);
    assert.strictEqual(parsed.get('222'), 1);
    const reply = ix.getReplies()[0];
    const content = typeof reply === 'string' ? reply : reply.content;
    assert.match(content, /cannot redeem/i);
  });

  test('should fail if redeem amount is zero', async () => {
    const channel = mockChannel('<@222>🏆x1');
    const ix = mockRedeem({
      for_whom: '222',
      amount: 0,
      channel
    });

    await handleRedeem(ix);
    const reply = ix.getReplies()[0];
    const content = typeof reply === 'string' ? reply : reply.content;
    assert.match(content, /must be non-zero/);
  });
});
