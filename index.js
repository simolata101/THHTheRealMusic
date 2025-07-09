
const crypto = require('crypto');
globalThis.crypto = crypto.webcrypto;
process.env.FFMPEG_PATH = require('ffmpeg-static');

require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

const prefix = 'thh!';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const player = new Player(client);

(async () => {
  await player.extractors.loadMulti(DefaultExtractors);
})();

client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // 🎶 Play Command
  if (cmd === 'play') {
    const query = args.join(' ');
    if (!query) return message.channel.send('❌ Please provide a song name or URL.');

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('❌ You need to be in a voice channel.');

    const searchResult = await player.search(query, {
      requestedBy: message.author
    });

    if (!searchResult || !searchResult.tracks.length)
      return message.channel.send('❌ No results found.');

    const queue = await player.nodes.create(message.guild, {
      metadata: {
        channel: message.channel
      },
      leaveOnEmpty: false,
      leaveOnEnd: false,
      leaveOnStop: false
    });

    try {
      if (!queue.connection) await queue.connect(voiceChannel);
    } catch {
      player.nodes.delete(message.guild.id);
      return message.channel.send('❌ Could not join your voice channel.');
    }

    queue.addTrack(searchResult.tracks[0]);
    await message.channel.send(`🎵 Now playing: **${searchResult.tracks[0].title}**`);

    if (!queue.isPlaying()) await queue.node.play();
  }

  // ⏹️ Stop command
  else if (cmd === 'stop') {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.channel.send('❌ Nothing is playing.');
    queue.delete();
    message.channel.send('🛑 Stopped the music and left the VC.');
  }

  // ℹ️ Help Command
  else if (cmd === 'help') {
    message.channel.send(`
🎶 **Music Commands**
\`${prefix}play <song>\` - Play a song from YouTube
\`${prefix}stop\` - Stop music and leave VC
\`${prefix}help\` - Show this help menu
    `);
  }
});

client.login(process.env.DISCORD_TOKEN);
