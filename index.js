require("dotenv").config(); // <-- Load .env

const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('lavashark');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.player = new Player(client, [
  {
    name: "Main",
    url: `http${process.env.LAVALINK_SECURE === 'true' ? 's' : ''}://${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
    auth: process.env.LAVALINK_PASSWORD,
    secure: process.env.LAVALINK_SECURE === 'true'
  }
]);

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.guild) return;

  const prefix = "!";
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  const voiceChannel = message.member.voice.channel;
  const player = client.player.connections.get(message.guild.id);

  if (command === "play") {
    if (!args.length) return message.reply("🔍 Provide a song name or URL.");
    if (!voiceChannel) return message.reply("🔊 Join a voice channel first.");

    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator
    });

    const node = client.player.nodes.get("Main");
    const search = await node.loadTracks(args.join(" "));
    if (!search || !search.tracks.length) return message.reply("❌ No results found.");

    const track = search.tracks[0];
    const conn = client.player.createConnection({
      guildId: message.guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId: message.channel.id
    });

    await conn.connect();
    conn.queue.add(track);
    if (!conn.playing) await conn.play();
    message.channel.send(`🎶 Now playing: **${track.info.title}**`);
  }

  if (command === "skip") {
    if (!player || !player.playing) return message.reply("⛔ Nothing is playing.");
    player.skip();
    message.channel.send("⏭️ Skipped current track.");
  }

  if (command === "stop") {
    if (!player) return message.reply("🚫 No music to stop.");
    player.destroy();
    message.channel.send("🛑 Music stopped and player destroyed.");
  }

  if (command === "queue") {
    if (!player || !player.queue.tracks.length) return message.reply("📭 Queue is empty.");
    const queueList = player.queue.tracks.map((t, i) => `${i + 1}. ${t.info.title}`).join("\n");
    message.channel.send(`📜 **Queue:**\n${queueList}`);
  }

  if (command === "volume") {
    if (!player) return message.reply("⛔ No music is playing.");
    if (!args[0]) return message.reply(`🔊 Current volume: **${player.volume}%**`);
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 0 || vol > 100) return message.reply("⚠️ Volume must be 0-100.");
    player.setVolume(vol);
    message.channel.send(`✅ Volume set to **${vol}%**`);
  }

  if (command === "pause") {
    if (!player || !player.playing) return message.reply("⛔ No music is playing.");
    if (player.paused) return message.reply("⏸️ Already paused.");
    player.pause(true);
    message.channel.send("⏸️ Playback paused.");
  }

  if (command === "resume") {
    if (!player || !player.playing) return message.reply("⛔ No music is playing.");
    if (!player.paused) return message.reply("▶️ Already playing.");
    player.pause(false);
    message.channel.send("▶️ Playback resumed.");
  }

  if (command === "loop") {
    if (!player || !player.playing) return message.reply("⛔ No music playing.");
    player.setRepeatMode(player.repeatMode === 0 ? 1 : 0);
    message.channel.send(player.repeatMode === 1 ? "🔁 Loop enabled" : "⏹️ Loop disabled");
  }

  if (command === "join") {
    if (!voiceChannel) return message.reply("🔊 Join a voice channel first.");
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });
    message.channel.send(`✅ Joined **${voiceChannel.name}**`);
  }

  if (command === "leave") {
    if (!player) return message.reply("🚫 Not connected to a voice channel.");
    player.destroy();
    message.channel.send("👋 Left the voice channel.");
  }
});

client.login(process.env.DISCORD_TOKEN);
