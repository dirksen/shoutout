// test.js
import assert from "assert";
import { Client, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";
import { AwardManager } from "./awards.js";

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;

async function runTests() {
  console.log("Running AwardManager tests…");

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  await new Promise((resolve, reject) => {
    client.once("ready", resolve);
    client.once("error", reject);
    client.login(token);
  });

  const guild = await client.guilds.fetch(guildId);
  const guildOwner = guild.ownerId;
  const me = guild.members.me;
  console.log(`Logged in as ${me.user.tag} (${me.roles.highest.position})`);
  await guild.members.fetch(); // populate cache

  const awards = new AwardManager(guild);

  // pick a test user (not the bot itself, not the owner, lower role)
  const member = guild.members.cache.find(
    (m) =>
      m.id !== guildOwner &&
      m.roles.highest.position < me.roles.highest.position &&
      !m.user.bot
  );
  if (!member) throw new Error("No non-bot member found for testing");
  const userId = member.id;

  // Reset nickname to base
  await member.setNickname(member.user.username);

  //
  // Test 1: shoutout
  //
  console.log("▶ Test shoutout…");
  await awards.updateAwards(userId, +1);
  await awards.whenIdle();

  const afterShoutout = await guild.members.fetch(userId);
  assert.match(afterShoutout.nickname, /🏆x1$/, "Shoutout failed");

  //
  // Test 2: redeem
  //
  console.log("▶ Test redeem…");
  await awards.updateAwards(userId, -1);
  await awards.whenIdle();

  const afterRedeem = await guild.members.fetch(userId);
  assert.ok(!/🏆x/.test(afterRedeem.nickname), "Redeem failed");

  //
  // Test 3: should not award oneself
  //
  console.log("▶ Test should not award oneself…");
  let selfError = null;
  try {
    await awards.updateAwards(me.id, +1);
    await awards.whenIdle();
  } catch (err) {
    selfError = err;
  }
  assert.ok(selfError, "Expected error when awarding oneself");

  //
  // Test 4: should fail if redeeming more than available
  //
  console.log("▶ Test should fail if redeeming more than available…");
  let overRedeemError = null;
  try {
    await awards.updateAwards(userId, -1); // no trophies to redeem
    await awards.whenIdle();
  } catch (err) {
    overRedeemError = err;
  }
  assert.ok(
    overRedeemError,
    "Expected error when redeeming more than available"
  );

  //
  // Test 5: should fail if redeem amount is zero
  //
  console.log("▶ Test should fail if redeem amount is zero…");
  let zeroError = null;
  try {
    await awards.updateAwards(userId, 0);
    await awards.whenIdle();
  } catch (err) {
    zeroError = err;
  }
  assert.ok(zeroError, "Expected error when redeeming zero amount");

  console.log("✅ All AwardManager tests passed");

  await client.destroy();
}

// Run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch((err) => {
    console.error("❌ Test failed", err);
    process.exit(1);
  });
}

export { runTests };
