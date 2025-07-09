require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Player } = require('discord-player');
const playdl = require('play-dl');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const player = new Player(client);
player.extractors.loadDefault();

const prefix = "thh!";

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  // Help command
  if (message.content.startsWith(`${prefix}help`)) {
    return message.reply(`
🎵 **Music Bot Commands**
\`\`\`
thh!play [song or URL]   – Play a song from YouTube
thh!skip                 – Skip the current song
thh!stop                 – Stop playback and leave VC
thh!help                 – Show this help message
\`\`\`
Note: Make sure you're in a voice channel!
    `);
  }

  // Play command
  if (message.content.startsWith(`${prefix}play`)) {
    const args = message.content.split(' ').slice(1);
    const query = args.join(' ');
    if (!query) return message.reply("❌ Please provide a song name or link.");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("🔊 Join a voice channel first.");

    const searchResult = await player.search(query, {
      requestedBy: message.author,
    });

    if (!searchResult || !searchResult.tracks.length)
      return message.reply("❌ No results found.");

    const queue = await player.nodes.create(message.guild, {
      metadata: {
        channel: message.channel
      }
    });

    try {
      if (!queue.connection) await queue.connect(voiceChannel);
    } catch {
      queue.delete();
      return message.reply("❌ Failed to join the voice channel.");
    }

    queue.addTrack(searchResult.tracks[0]);

    if (!queue.isPlaying()) await queue.node.play();

    message.reply(`🎶 Now playing: **${searchResult.tracks[0].title}**`);
  }

  // Skip command
  if (message.content.startsWith(`${prefix}skip`)) {
    const queue = player.nodes.get(message.guild.id);
    if (!queue || !queue.isPlaying()) return message.reply("❌ Nothing is playing.");
    queue.node.skip();
    message.reply("⏭️ Skipped the current track.");
  }

  // Stop command
  if (message.content.startsWith(`${prefix}stop`)) {
    const queue = player.nodes.get(message.guild.id);
    if (!queue) return message.reply("❌ Nothing to stop.");
    queue.delete();
    message.reply("🛑 Playback stopped and queue cleared.");
  }
});

client.login(process.env.DISCORD_TOKEN);
