require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { LavaShark } = require('lavashark');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Lavashark Setup
client.player = new LavaShark({
  userID: '0', // Will be set on ready
  sendWS: (guildId, payload) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild?.shard) guild.shard.send(payload);
  },
  nodes: [
    {
      hostname: 'LavaLink V4',
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

// Prefix
const prefix = '!';

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const voiceChannel = message.member.voice.channel;
  const guildId = message.guild.id;

  if (cmd === 'join') {
    if (!voiceChannel) return message.reply('🎧 Join a voice channel first!');
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: true
    });
    return message.reply('✅ Joined your voice channel!');
  }

  if (cmd === 'leave') {
    const player = client.player.players.get(guildId);
    if (player) {
      await player.destroy();
      return message.reply('👋 Left the voice channel.');
    } else {
      return message.reply('⚠️ Not connected to any voice channel.');
    }
  }

  if (cmd === 'play') {
    if (!args[0]) return message.reply('🔍 Provide a search term or URL.');
    if (!voiceChannel) return message.reply('🎧 Join a voice channel first!');

    const searchResult = await client.player.search(args.join(' '));
    if (!searchResult || !searchResult.tracks.length) return message.reply('❌ No results found.');

    const track = searchResult.tracks[0];

    let player = client.player.players.get(guildId);
    if (!player) {
      player = client.player.createPlayer({
        guildId,
        voiceChannelId: voiceChannel.id,
        textChannelId: message.channel.id,
        selfDeaf: true
      });
    }

    player.queue.add(track);

    if (!player.playing && !player.paused) {
      await player.connect();
      await player.play();
    }

    return message.reply(`🎶 Now playing: **${track.info.title}**`);
  }

  if (cmd === 'pause') {
    const player = client.player.players.get(guildId);
    if (!player) return message.reply('🚫 Nothing is playing.');
    await player.pause(true);
    return message.reply('⏸️ Paused.');
  }

  if (cmd === 'resume') {
    const player = client.player.players.get(guildId);
    if (!player) return message.reply('🚫 Nothing is playing.');
    await player.pause(false);
    return message.reply('▶️ Resumed.');
  }

  if (cmd === 'stop') {
    const player = client.player.players.get(guildId);
    if (!player) return message.reply('🚫 Nothing to stop.');
    player.queue.clear();
    player.stop();
    return message.reply('⏹️ Stopped playback.');
  }

  if (cmd === 'skip') {
    const player = client.player.players.get(guildId);
    if (!player) return message.reply('🚫 Nothing to skip.');
    player.stop();
    return message.reply('⏭️ Skipped.');
  }

  if (cmd === 'queue') {
    const player = client.player.players.get(guildId);
    if (!player || player.queue.tracks.length === 0) return message.reply('📭 The queue is empty.');
    const list = player.queue.tracks.map((t, i) => `${i + 1}. ${t.info.title}`).join('\n');
    return message.reply(`📜 Queue:\n${list}`);
  }

  if (cmd === 'volume') {
    const player = client.player.players.get(guildId);
    const vol = parseInt(args[0]);
    if (!player) return message.reply('🚫 No player found.');
    if (isNaN(vol) || vol < 0 || vol > 1000) return message.reply('🔊 Volume must be 0-1000.');
    await player.setVolume(vol);
    return message.reply(`🔊 Volume set to ${vol}`);
  }

  if (cmd === 'loop') {
    const player = client.player.players.get(guildId);
    if (!player) return message.reply('🚫 No player found.');
    player.setTrackRepeat(!player.trackRepeat);
    return message.reply(player.trackRepeat ? '🔁 Looping current track.' : '➡️ Loop disabled.');
  }
});

client.login(process.env.DISCORD_TOKEN);
