// index.js — Don't KYS Bot (paginación ilimitada, config y media por servidor)
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require('@discordjs/voice');

const path  = require('path');
const fs    = require('fs');
const https = require('https');
const http  = require('http');

// ---------------------------------------------
//  HELPER: descargar archivo desde una URL
// ---------------------------------------------
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file  = fs.createWriteStream(destPath);
    proto.get(url, res => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// ---------------------------------------------
//  CONFIGURACIÓN DE BOTONES (persistente en JSON, por servidor)
//  Estructura: { "<guildId>": { "<clipId>": { label, emoji, file } } }
// ---------------------------------------------
const CONFIG_PATH = path.join(__dirname, 'buttonConfig.json');

function loadAllConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  return {};
}

function saveAllConfig(all) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(all, null, 2));
}

let allConfig = loadAllConfig();

function getGuildConfig(guildId) {
  if (!allConfig[guildId]) allConfig[guildId] = {};
  return allConfig[guildId];
}

function saveGuildConfig(guildId, guildConfig) {
  allConfig[guildId] = guildConfig;
  saveAllConfig(allConfig);
}

// Cada servidor tiene su propia carpeta media/<guildId>/, así los archivos
// (y sus nombres) nunca se pisan ni se comparten entre servidores.
function mediaDir(guildId) {
  const dir = path.join(__dirname, 'media', guildId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------
//  CLIENTE DISCORD
// ---------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ---------------------------------------------
//  PAGINACIÓN
//  Cada página tiene hasta 20 clips (4 filas × 5 botones)
//  La 5ª fila queda reservada para los botones ◀ ▶
// ---------------------------------------------
const CLIPS_PER_PAGE = 20;

function buildPageRows(config, page) {
  const ids = Object.keys(config).map(Number).sort((a, b) => a - b);
  const totalPages = Math.ceil(ids.length / CLIPS_PER_PAGE);
  page = Math.max(0, Math.min(page, totalPages - 1)); // clamp

  const pageIds = ids.slice(page * CLIPS_PER_PAGE, (page + 1) * CLIPS_PER_PAGE);
  const rows = [];

  for (let i = 0; i < pageIds.length; i++) {
    const id  = pageIds[i];
    const cfg = config[id];

    const button = new ButtonBuilder()
      .setCustomId(`play_clip_${id}`)
      .setLabel(`${cfg.emoji ?? '🎵'} ${cfg.label}`)
      .setStyle(ButtonStyle.Primary);

    if (i % 5 === 0) rows.push(new ActionRowBuilder());
    rows[Math.floor(i / 5)].addComponents(button);
  }

  // Fila de navegación (siempre presente si hay más de una página)
  if (totalPages > 1) {
    const navRow = new ActionRowBuilder();

    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`page_prev_${page}`)
        .setLabel('◀ Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),

      new ButtonBuilder()
        .setCustomId(`page_indicator`)
        .setLabel(`Página ${page + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId(`page_next_${page}`)
        .setLabel('Siguiente ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1),
    );

    rows.push(navRow);
  }

  return { rows, page, totalPages };
}

// ---------------------------------------------
//  HELPER: enviar panel cajadank (para un servidor puntual)
// ---------------------------------------------
async function sendCajaDank(target, guildId) {
  const config = getGuildConfig(guildId);

  if (Object.keys(config).length === 0) {
    return target.reply('📭 No hay clips cargados todavía en este servidor. Usá `!addclip 🎵 Nombre` adjuntando un .mp3 para agregar uno.');
  }
  const { rows, totalPages } = buildPageRows(config, 0);
  const total = Object.keys(config).length;
  return target.reply({
    content: `🎵 Elegí un clip para reproducir en el canal de voz: *(${total} clips, ${totalPages} página${totalPages > 1 ? 's' : ''})*`,
    components: rows,
  });
}

// ---------------------------------------------
//  COMANDOS DE TEXTO
// ---------------------------------------------
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const msg     = message.content;
  const args    = msg.trim().split(/\s+/);
  const cmd     = args[0].toLowerCase();
  const guildId = message.guildId; // null si es un DM

  // --- !ping ---
  if (cmd === '!ping') {
    return message.reply('Pong! 🏓');
  }

  // --- rick roll ---
  if (msg.toLowerCase() === 'rick') {
    return message.channel.send('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  }

  // --- palabras gatillo ---
  const triggerWords = [
    'me voy a matar', 'me quiero matar', 'me mato',
    'no se maten', 'kill myself', 'kms',
  ];
  if (triggerWords.some(w => msg.toLowerCase().includes(w))) {
    return message.reply({
      files: [path.join(__dirname, 'CGiAn47Q8ZYNdIZC.mp4')],
    });
  }

  const triggerWords2 = [
    'nigga','negro','black','kuro','macaco',
  ];
  if (triggerWords2.some(w => msg.toLowerCase().includes(w))) {
    return message.reply({
      files: [path.join(__dirname, 'Niga.mp4')],
    });
  }

  // A partir de acá, todos los comandos de la cajadank necesitan un servidor
  const cajaDankCommands = ['!cajadank', '!setbutton', '!addclip', '!removeclip', '!listclips', '!setfile'];
  if (cajaDankCommands.includes(cmd) && !guildId) {
    return message.reply('❌ Este comando solo funciona dentro de un servidor.');
  }

  // -- !cajadank ------------------------------
  if (cmd === '!cajadank') {
    return sendCajaDank(message, guildId);
  }

  // -- !setbutton <id> <emoji> <nombre> -------
  if (cmd === '!setbutton') {
    const config = getGuildConfig(guildId);
    const id    = parseInt(args[1]);
    const emoji = args[2] ?? '🎵';
    const label = args.slice(3).join(' ');

    if (isNaN(id) || id < 1) {
      return message.reply('❌ Número de botón inválido (debe ser ≥ 1).');
    }
    if (!label) {
      return message.reply('❌ Usá: `!setbutton <id> <emoji> <nombre>`\nEjemplo: `!setbutton 3 🔥 Fuego épico`');
    }

    config[id] = {
      label,
      emoji,
      file: config[id]?.file ?? `clip${id}.mp3`,
    };
    saveGuildConfig(guildId, config);
    await message.reply(`✅ Botón ${id} actualizado: ${emoji} ${label}`);
    return sendCajaDank(message, guildId);
  }

  // -- !addclip <emoji> <nombre> [+ adjunto .mp3/.ogg/.wav] -
  if (cmd === '!addclip') {
    const config = getGuildConfig(guildId);
    const emoji = args[1] ?? '🎵';
    const label = args.slice(2).join(' ');

    const ids   = Object.keys(config).map(Number);
    const newId = ids.length > 0 ? Math.max(...ids) + 1 : 1;

    const attachment = message.attachments.first();
    const validExts  = ['.mp3', '.ogg', '.wav'];
    const hasAudio   = attachment && validExts.some(e => attachment.name.toLowerCase().endsWith(e));
    const fileName   = hasAudio ? attachment.name : `clip${newId}.mp3`;
    const destPath   = path.join(mediaDir(guildId), fileName);

    config[newId] = { label, emoji, file: fileName };
    saveGuildConfig(guildId, config);

    if (hasAudio) {
      try {
        await message.reply(`⏳ Descargando \`${fileName}\`...`);
        await downloadFile(attachment.url, destPath);
        await message.reply(`✅ Clip ${newId} guardado: ${emoji} **${label}** → \`media/${guildId}/${fileName}\``);
      } catch (err) {
        console.error('Error descargando archivo:', err);
        await message.reply(`⚠️ Clip ${newId} registrado pero falló la descarga. Subí \`${fileName}\` manualmente a \`media/${guildId}/\`.`);
      }
    } else {
      await message.reply(
        `✅ Clip ${newId} registrado: ${emoji} **${label}**\n` +
        `💡 Tip: la próxima vez adjuntá el **.mp3** en el mismo mensaje y el bot lo descarga solo.\n` +
        `📂 O subí manualmente el archivo a \`media/${guildId}/${fileName}\`.`
      );
    }

    // Mostrar el panel actualizado automáticamente
    return sendCajaDank(message, guildId);
  }

  // -- !removeclip <id> -----------------------
  if (cmd === '!removeclip') {
    const config = getGuildConfig(guildId);
    const id = parseInt(args[1]);
    if (isNaN(id) || !config[id]) {
      return message.reply('❌ ID de clip inválido o no existe.');
    }
    const removed = config[id];
    delete config[id];
    saveGuildConfig(guildId, config);
    await message.reply(`🗑️ Clip ${id} (${removed.emoji} ${removed.label}) eliminado.`);
    return sendCajaDank(message, guildId);
  }

  // -- !listclips -----------------------------
  if (cmd === '!listclips') {
    const config = getGuildConfig(guildId);
    const entries = Object.entries(config).sort(([a], [b]) => Number(a) - Number(b));
    const total = entries.length;

    if (total === 0) return message.reply('📭 No hay clips configurados en este servidor.');

    const CHUNK = 30;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const lines = entries.slice(i, i + CHUNK)
        .map(([id, c]) => `\`${id}\` — ${c.emoji} **${c.label}** → \`${c.file}\``);
      const header = i === 0 ? `📋 **Clips configurados (${total} total):**\n` : '';
      await message.reply(`${header}${lines.join('\n')}`);
    }
    return;
  }

  // -- !setfile <id> <archivo.mp3> ------------
  if (cmd === '!setfile') {
    const config = getGuildConfig(guildId);
    const id   = parseInt(args[1]);
    const file = args[2];
    if (isNaN(id) || !config[id]) {
      return message.reply('❌ ID inválido.');
    }
    if (!file || !file.match(/\.(mp3|ogg|wav)$/i)) {
      return message.reply('❌ Indicá un archivo .mp3/.ogg/.wav. Ej: `!setfile 3 sonido_nuevo.mp3`');
    }
    config[id].file = file;
    saveGuildConfig(guildId, config);
    await message.reply(`✅ Botón ${id} ahora reproduce \`${file}\` (buscado en \`media/${guildId}/\`).`);
    return sendCajaDank(message, guildId);
  }

  // -- !purge <cantidad> ----------------------
  if (cmd === '!purge') {
    if (!message.member.permissions.has('ManageMessages')) {
      return message.reply('❌ No tenés permiso para usar este comando.');
    }

    const amount = parseInt(args[1]);

    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply('❌ Indicá una cantidad entre 1 y 100. Ej: `!purge 10`');
    }

    try {
      await message.delete();

      const fetched = await message.channel.messages.fetch({ limit: amount });

      let deletedCount = 0;
      try {
        const bulk = await message.channel.bulkDelete(fetched, true);
        deletedCount = bulk.size;
      } catch {
        for (const msg of fetched.values()) {
          try {
            await msg.delete();
            deletedCount++;
          } catch {}
        }
      }

    } catch (err) {
      console.error('Error en !purge:', err);
      return message.channel.send(`❌ Error: \`${err.message}\``);
    }
  }

  // -- !help ----------------------------------
  if (cmd === '!help') {
    return message.reply(`
**🎵 Comandos disponibles:**
\`!cajadank\` — Mostrar panel de clips (con páginas si hay más de 20)
\`!addclip <emoji> <nombre>\` — Agregar un clip nuevo *(sin límite)*
\`!removeclip <id>\` — Eliminar un clip
\`!setbutton <id> <emoji> <nombre>\` — Renombrar un botón
\`!setfile <id> <archivo>\` — Cambiar el archivo de un botón
\`!listclips\` — Ver todos los clips configurados
\`!ping\` — Test de conexión
\`!purge <cantidad>\` — Borrar mensajes del canal (máx. 100)

Los clips son propios de cada servidor: lo que se agrega acá no aparece en otros servidores donde esté el bot.
    `.trim());
  }
});

// ---------------------------------------------
//  INTERACCIONES (botones de clips + navegación)
// ---------------------------------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const id      = interaction.customId;
  const guildId = interaction.guildId;

  if (!guildId) return;

  const config = getGuildConfig(guildId);

  // -- Botones de paginación ------------------
  if (id.startsWith('page_prev_') || id.startsWith('page_next_')) {
    await interaction.deferUpdate();

    const currentPage = parseInt(id.split('_')[2]);
    const newPage     = id.startsWith('page_prev_') ? currentPage - 1 : currentPage + 1;

    const { rows } = buildPageRows(config, newPage);
    const total      = Object.keys(config).length;
    const totalPages = Math.ceil(total / CLIPS_PER_PAGE);

    return interaction.editReply({
      content: `🎵 Elegí un clip para reproducir en el canal de voz: *(${total} clips, ${totalPages} páginas)*`,
      components: rows,
    });
  }

  // -- Botón indicador (deshabilitado, no hace nada) --
  if (id === 'page_indicator') {
    return interaction.deferUpdate();
  }

  // -- Reproducir clip ------------------------
  if (!id.startsWith('play_clip_')) return;

  await interaction.deferReply({ ephemeral: true });

  const clipId  = parseInt(id.split('_')[2]);
  const clipCfg = config[clipId];

  if (!clipCfg) {
    return interaction.editReply('❌ Este clip no existe en la configuración de este servidor.');
  }

  const clipPath = path.join(mediaDir(guildId), clipCfg.file);

  if (!fs.existsSync(clipPath)) {
    return interaction.editReply(`❌ Archivo no encontrado: \`media/${guildId}/${clipCfg.file}\``);
  }

  const voiceChannel = interaction.member.voice?.channel;
  if (!voiceChannel) {
    return interaction.editReply('🔇 Tenés que estar en un canal de voz primero.');
  }

  try {
    const connection = joinVoiceChannel({
      channelId:      voiceChannel.id,
      guildId:        voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    const player   = createAudioPlayer();
    const resource = createAudioResource(clipPath);

    connection.subscribe(player);
    player.play(resource);

    await interaction.deleteReply();

    player.on(AudioPlayerStatus.Idle, () => connection.destroy());
    player.on('error', err => {
      console.error('Error de audio:', err);
      connection.destroy();
    });

  } catch (err) {
    console.error('Error al unirse al canal de voz:', err);
    return interaction.editReply('❌ No pude unirme al canal de voz.');
  }
});

// ---------------------------------------------
client.login(process.env.DISCORD_TOKEN);
