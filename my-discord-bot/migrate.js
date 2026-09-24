// migrate.js — Convierte buttonConfig.json (formato plano, sin servidor)
// al nuevo formato por servidor, y mueve los archivos de media/ a
// media/<GUILD_ID>/ para que queden asociados a ese servidor puntual.
//
// Uso:
//   node migrate.js <GUILD_ID>
//
// Ejemplo:
//   node migrate.js 123456789012345678   (ID de Patagonia Rebelde)
//
// Corré esto UNA sola vez, con el bot apagado, antes de reemplazar index.js.

const fs   = require('fs');
const path = require('path');

const guildId = process.argv[2];
if (!guildId || !/^\d+$/.test(guildId)) {
  console.error('❌ Uso: node migrate.js <GUILD_ID>');
  console.error('   El GUILD_ID debe ser el número que copiaste con "Copiar ID del servidor".');
  process.exit(1);
}

const CONFIG_PATH = path.join(__dirname, 'buttonConfig.json');
const MEDIA_DIR   = path.join(__dirname, 'media');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error('❌ No encontré buttonConfig.json en esta carpeta.');
  process.exit(1);
}

const oldConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Si ya está en formato nuevo (los valores son objetos de clips, no un clip
// individual con "label"/"emoji"), no reescribimos el config — pero igual
// seguimos abajo para mover los archivos de media/.
const looksAlreadyMigrated = Object.values(oldConfig).some(
  v => typeof v === 'object' && v !== null && !('label' in v)
);
if (looksAlreadyMigrated) {
  console.log('✅ buttonConfig.json ya está en formato por servidor — no lo toco.');
} else {
  // Backup del archivo original, por las dudas
  fs.writeFileSync(CONFIG_PATH + '.backup', JSON.stringify(oldConfig, null, 2));
  console.log('📦 Backup guardado en buttonConfig.json.backup');

  // Envolvemos todo el config actual bajo el guildId indicado
  const newConfig = { [guildId]: oldConfig };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
  console.log(`✅ buttonConfig.json migrado — todos los clips ahora pertenecen al servidor ${guildId}`);
}

// Movemos los archivos sueltos de media/ a media/<guildId>/
if (fs.existsSync(MEDIA_DIR)) {
  const guildMediaDir = path.join(MEDIA_DIR, guildId);
  if (!fs.existsSync(guildMediaDir)) fs.mkdirSync(guildMediaDir, { recursive: true });

  const filesToMove = fs.readdirSync(MEDIA_DIR).filter(f =>
    fs.statSync(path.join(MEDIA_DIR, f)).isFile()
  );

  for (const file of filesToMove) {
    fs.renameSync(path.join(MEDIA_DIR, file), path.join(guildMediaDir, file));
  }
  console.log(`🎵 ${filesToMove.length} archivos movidos de media/ a media/${guildId}/`);
} else {
  console.log('⚠️ No encontré una carpeta media/ para mover — revisá que los .mp3 estén donde el bot espera.');
}

console.log('\n🎉 Listo. Ahora reemplazá index.js por la versión nueva y reiniciá el bot.');
