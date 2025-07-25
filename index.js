require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { LavaShark } = require('lavashark');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

console.log("ENV:", {
  host: process.env.LAVALINK_HOST,
  port: process.env.LAVALINK_PORT,
  password: process.env.LAVALINK_PASSWORD,
  secure: process.env.LAVALINK_SECURE
});

// Lavashark Setup
client.player = new LavaShark({
  userID: '0', // Will be set on client ready
  sendWS: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) guild.shard.send(payload);
  },
  nodes: [
    {
      name: 'MainNode',
      host: process.env.LAVALINK_HOST,
      port: Number(process.env.LAVALINK_PORT),
      password: process.env.LAVALINK_PASSWORD,
      secure: process.env.LAVALINK_SECURE === 'true'
    }
  ]
});

client.once('ready', () => {
  client.player.userID = client.user.id;
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === 'join') {
    if (!message.member.voice.channel) return message.reply('🎧 Join a voice channel first!');
    joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: true
    });
    return message.reply('✅ Joined your voice channel!');
  }

  if (cmd === 'leave') {
    getVoiceConnection(message.guild.id)?.destroy();
    client.player.connections.delete(message.guild.id);
    return message.reply('👋 Left the voice channel.');
  }

  if (cmd === 'play') {
    if (!args[0]) return message.reply('🔍 Provide a search term or URL.');

    if (!message.member.voice.channel) return message.reply('🎧 Join a voice channel first!');
    const connection = joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator
    });

    let player = client.player.connections.get(message.guild.id);
    if (!player) {
      player = client.player.createPlayer({
        guildId: message.guild.id,
        voiceChannelId: message.member.voice.channel.id,
        textChannelId: message.channel.id,
        selfDeaf: true
      });
    }

    const results = await client.player.load(args.join(' '));
    if (!results || !results.tracks.length) return message.reply('❌ No results found.');

    const track = results.tracks[0];
    player.queue.add(track);

    if (!player.playing) {
      await player.connect();
      await player.play();
    }

    return message.reply(`🎶 Now playing: **${track.info.title}**`);
  }

  if (cmd === 'pause') {
    const player = client.player.connections.get(message.guild.id);
    if (!player) return message.reply('🚫 Nothing is playing.');
    await player.pause(true);
    return message.reply('⏸️ Paused.');
  }

  if (cmd === 'resume') {
    const player = client.player.connections.get(message.guild.id);
    if (!player) return message.reply('🚫 Nothing is playing.');
    await player.pause(false);
    return message.reply('▶️ Resumed.');
  }

  if (cmd === 'stop') {
    const player = client.player.connections.get(message.guild.id);
    if (!player) return message.reply('🚫 Nothing to stop.');
    player.queue.clear();
    player.stop();
    return message.reply('⏹️ Stopped playback.');
  }

  if (cmd === 'skip') {
    const player = client.player.connections.get(message.guild.id);
    if (!player) return message.reply('🚫 Nothing to skip.');
    player.stop();
    return message.reply('⏭️ Skipped.');
  }

  if (cmd === 'queue') {
    const player = client.player.connections.get(message.guild.id);
    if (!player || player.queue.tracks.length === 0) return message.reply('📭 The queue is empty.');
    const list = player.queue.tracks.map((t, i) => `${i + 1}. ${t.info.title}`).join('\n');
    return message.reply(`📜 Queue:\n${list}`);
  }

  if (cmd === 'volume') {
    const volume = parseInt(args[0]);
    const player = client.player.connections.get(message.guild.id);
    if (!player) return message.reply('🚫 No player found.');
    if (isNaN(volume) || volume < 0 || volume > 1000) return message.reply('🔊 Enter a volume between 0 and 1000.');
    await player.setVolume(volume);
    return message.reply(`🔊 Volume set to ${volume}`);
  }

  if (cmd === 'loop') {
    const player = client.player.connections.get(message.guild.id);
    if (!player) return message.reply('🚫 No player found.');
    player.setTrackRepeat(!player.trackRepeat);
    return message.reply(player.trackRepeat ? '🔁 Looping current track.' : '➡️ Loop disabled.');
  }
});

// Voice state updates
client.on('raw', (d) => {
  client.player.updateVoiceState(d);
});

client.login(process.env.DISCORD_TOKEN);
