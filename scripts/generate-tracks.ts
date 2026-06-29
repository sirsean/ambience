/**
 * Generate ambience tracks via ElevenLabs and upload to R2.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   npm run generate-tracks -- --milieu day
 *   npm run generate-tracks -- --tracks day-zen-garden,day-contemplation --base-only
 *
 * Base tracks use the ElevenLabs Music API (music_v2) for longer, calmer compositions.
 * Chimes still use the Sound Effects API.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegStatic from 'ffmpeg-static';
import { SEED_TRACKS, type SeedTrack } from '../worker/data/seed-tracks';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../.generated-tracks');
const BUCKET = process.env.R2_BUCKET_NAME ?? 'ambience-audio';

interface GenerateOptions {
  apiKey: string;
  dryRun: boolean;
  baseOnly: boolean;
  engine: 'auto' | 'music' | 'sfx-stitch';
}

interface MusicChunk {
  text: string;
  duration_ms: number;
  positive_styles: string[];
  negative_styles: string[];
  context_adherence?: 'low' | 'medium' | 'high';
}

interface MusicTrackConfig {
  compositionPlan: { chunks: MusicChunk[] };
}

const CALM_NEGATIVE = [
  'drums',
  'percussion',
  'beat',
  'busy',
  'distracting',
  'melodic hook',
  'catchy melody',
  'vocals',
  'singing',
  'upbeat',
  'energetic',
  'fast tempo',
  'electronic dance',
  'sharp transients',
];

const MUSIC_BY_TRACK: Record<string, MusicTrackConfig> = {
  'day-zen-garden': {
    compositionPlan: {
      chunks: [
        {
          text: '[Opening]\n{instrumental only}\n{soft sustained pads}\n{spacious silence between notes}\n{zen garden atmosphere}',
          duration_ms: 120_000,
          positive_styles: [
            'ambient meditation',
            'zen garden',
            'minimal',
            'sparse',
            'soft pads',
            'gentle nature atmosphere',
            'contemplative',
            'slow evolving',
          ],
          negative_styles: CALM_NEGATIVE,
          context_adherence: 'high',
        },
        {
          text: '[Continuation]\n{instrumental only}\n{same calm mood}\n{very subtle texture shifts}\n{no new elements}',
          duration_ms: 120_000,
          positive_styles: [
            'ambient meditation',
            'zen garden',
            'minimal',
            'soft pads',
            'deeply calm',
            'background music',
          ],
          negative_styles: CALM_NEGATIVE,
          context_adherence: 'high',
        },
      ],
    },
  },
  'day-contemplation': {
    compositionPlan: {
      chunks: [
        {
          text: '[Drift]\n{instrumental only}\n{warm ambient drone}\n{meditation music}\n{barely perceptible movement}',
          duration_ms: 120_000,
          positive_styles: [
            'contemplative ambient',
            'meditation music',
            'warm drone',
            'stillness',
            'mindfulness',
            'soft atmospheric',
          ],
          negative_styles: CALM_NEGATIVE,
          context_adherence: 'high',
        },
        {
          text: '[Deepen]\n{instrumental only}\n{continuing drone}\n{even quieter}\n{no rhythmic elements}',
          duration_ms: 120_000,
          positive_styles: [
            'contemplative ambient',
            'meditation music',
            'minimal drone',
            'peaceful',
            'background for focus',
          ],
          negative_styles: CALM_NEGATIVE,
          context_adherence: 'high',
        },
      ],
    },
  },
  'night-deep-calm': {
    compositionPlan: {
      chunks: [
        {
          text: '[Night]\n{instrumental only}\n{dark soft pads}\n{sleep inducing}\n{very slow}',
          duration_ms: 120_000,
          positive_styles: ['dark ambient', 'sleep music', 'soft pads', 'minimal', 'deep calm'],
          negative_styles: CALM_NEGATIVE,
          context_adherence: 'high',
        },
        {
          text: '[Deep night]\n{instrumental only}\n{continuing dark ambient}\n{no surprises}',
          duration_ms: 120_000,
          positive_styles: ['dark ambient', 'sleep music', 'sparse', 'hypnotic', 'gentle'],
          negative_styles: CALM_NEGATIVE,
          context_adherence: 'high',
        },
      ],
    },
  },
  'night-starry-drone': {
    compositionPlan: {
      chunks: [
        {
          text: '[Stars]\n{instrumental only}\n{ethereal drone}\n{night sky}\n{extremely gentle}',
          duration_ms: 120_000,
          positive_styles: ['ethereal ambient', 'space drone', 'soft', 'minimal', 'sleep'],
          negative_styles: CALM_NEGATIVE,
          context_adherence: 'high',
        },
        {
          text: '[Drift]\n{instrumental only}\n{same ethereal tone}\n{no percussion}',
          duration_ms: 120_000,
          positive_styles: ['ethereal ambient', 'soft drone', 'calm', 'background'],
          negative_styles: CALM_NEGATIVE,
          context_adherence: 'high',
        },
      ],
    },
  },
  'sunrise-golden-awake': {
    compositionPlan: {
      chunks: [
        {
          text: '[Dawn]\n{instrumental only}\n{warm gentle pads}\n{hopeful but still calm}\n{no alarm}',
          duration_ms: 90_000,
          positive_styles: ['warm ambient', 'gentle awakening', 'soft', 'hopeful', 'slow sunrise mood'],
          negative_styles: [...CALM_NEGATIVE, 'alarm', 'loud', 'jarring'],
          context_adherence: 'high',
        },
        {
          text: '[Light]\n{instrumental only}\n{subtle brightness}\n{still ambient not rhythmic}',
          duration_ms: 90_000,
          positive_styles: ['warm ambient', 'gentle', 'morning atmosphere', 'soft pads'],
          negative_styles: [...CALM_NEGATIVE, 'alarm', 'loud'],
          context_adherence: 'high',
        },
      ],
    },
  },
  'sunrise-early-light': {
    compositionPlan: {
      chunks: [
        {
          text: '[Early light]\n{instrumental only}\n{soft golden tones}\n{quiet morning}',
          duration_ms: 90_000,
          positive_styles: ['soft ambient', 'morning light', 'gentle', 'minimal', 'warm'],
          negative_styles: [...CALM_NEGATIVE, 'alarm'],
          context_adherence: 'high',
        },
        {
          text: '[Brighten]\n{instrumental only}\n{slightly brighter pads}\n{still no beat}',
          duration_ms: 90_000,
          positive_styles: ['soft ambient', 'uplifting but calm', 'morning', 'background'],
          negative_styles: [...CALM_NEGATIVE, 'alarm'],
          context_adherence: 'high',
        },
      ],
    },
  },
};

const SFX_STITCH_SEGMENTS: Record<string, string[]> = {
  'day-zen-garden': [
    'extremely minimal ambient pad, zen garden, almost silence, no percussion, no melody, no rhythm',
    'sparse soft atmospheric texture, distant bamboo wind, meditation stillness, instrumental only',
    'very quiet sustained drone, single soft tone, zen meditation, nothing distracting',
    'gentle nature ambience, soft air movement, minimal pads, no beats, deeply calm',
    'barely changing ambient wash, soft green mood, zen garden background, instrumental',
    'quiet meditative atmosphere, soft reverb tail, no melodic movement, no percussion',
    'slow ambient fade, minimal harmonic content, peaceful garden mood, sparse',
    'return to near silence, soft pad holding one chord, zen contemplation, no rhythm',
  ],
  'day-contemplation': [
    'warm minimal ambient drone, contemplative, almost static, no percussion no melody',
    'soft meditative pad, mindfulness music, extremely slow evolution, instrumental',
    'quiet atmospheric texture, inner stillness, no rhythmic elements, background calm',
    'gentle warm drone continuing, meditation music, sparse and unobtrusive',
    'deeply quiet ambient layer, soft focus music, no hooks no beats',
    'subtle harmonic shift, still minimal, contemplative mood, instrumental only',
    'barely perceptible ambient movement, warm and soft, meditation background',
    'fading contemplative drone, peaceful resolution, no percussion, very calm',
  ],
  'night-deep-calm': [
    'dark minimal ambient drone, sleep inducing, almost silence, no percussion',
    'soft dark pad, deep calm, no melody, no rhythm, sparse night atmosphere',
    'quiet night ambient, gentle low tone, hypnotic stillness, instrumental',
    'continuing dark ambient wash, sleep music, minimal movement',
  ],
  'night-starry-drone': [
    'ethereal dark ambient, starry night, minimal sparse pads, no percussion',
    'soft space drone, quiet night sky, no melody no beat, instrumental',
    'continuing ethereal ambient, deep calm, barely changing texture',
    'gentle night drone fading, sleep atmosphere, minimal',
  ],
  'sunrise-golden-awake': [
    'warm soft ambient dawn, gentle awakening, no alarm, no beat, minimal pads',
    'quiet morning atmosphere, hopeful but calm, soft golden tone, instrumental',
    'gentle brightening ambient pad, still no rhythm, peaceful morning',
    'soft sunrise ambient continuing, warm and quiet, no percussion',
  ],
  'sunrise-early-light': [
    'soft morning ambient, early light, minimal warm pads, no beat',
    'gentle quiet dawn texture, calm awakening, instrumental only',
    'continuing soft morning ambient, peaceful, no rhythmic elements',
    'warm minimal morning pad, quiet hopefulness, no percussion',
  ],
};

const CHIME_PROMPTS: Record<string, string[]> = {
  night: [
    'soft distant bell chime, ethereal, sleep inducing',
    'gentle wind chime, single strike, reverb tail',
  ],
  sunrise: ['bright marimba tap, warm morning tone', 'gentle uplifting chime, golden sunrise feeling'],
  day: ['Tibetan singing bowl strike, meditation', 'soft meditation gong, single hit, long decay'],
};

function loadEnvFile(): void {
  const envPath = join(__dirname, '../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(): { milieu?: string; tracks?: string[]; baseOnly: boolean; engine: GenerateOptions['engine'] } {
  const args = process.argv.slice(2);
  const milieu = args.find((a) => a.startsWith('--milieu='))?.split('=')[1];
  const tracks = args
    .find((a) => a.startsWith('--tracks='))
    ?.split('=')[1]
    ?.split(',')
    .filter(Boolean);
  const baseOnly = args.includes('--base-only');
  const engineArg = args.find((a) => a.startsWith('--engine='))?.split('=')[1];
  const engine =
    engineArg === 'music' || engineArg === 'sfx-stitch' || engineArg === 'auto' ? engineArg : 'auto';
  return { milieu, tracks, baseOnly, engine };
}

function filterTracks(milieu?: string, trackIds?: string[]): SeedTrack[] {
  return SEED_TRACKS.filter((track) => {
    if (trackIds?.length && !trackIds.includes(track.manifest.id)) return false;
    if (milieu && track.manifest.milieu !== milieu) return false;
    return true;
  });
}

async function generateMusicTrack(apiKey: string, config: MusicTrackConfig): Promise<ArrayBuffer> {
  const totalMs = config.compositionPlan.chunks.reduce((sum, c) => sum + c.duration_ms, 0);
  console.log(`  Music API: ${Math.round(totalMs / 1000)}s composition (${config.compositionPlan.chunks.length} sections)...`);

  const response = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      model_id: 'music_v2',
      composition_plan: config.compositionPlan,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`ElevenLabs Music API error ${response.status}: ${text}`) as Error & {
      status: number;
    };
    err.status = response.status;
    throw err;
  }

  return response.arrayBuffer();
}

function stitchMp3Segments(segmentPaths: string[], outputPath: string): void {
  if (!ffmpegStatic) throw new Error('ffmpeg-static not available');

  const listPath = join(dirname(outputPath), 'concat-list.txt');
  writeFileSync(listPath, segmentPaths.map((p) => `file '${p}'`).join('\n'));
  execSync(`"${ffmpegStatic}" -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}" -y`, {
    stdio: 'inherit',
  });
  unlinkSync(listPath);
}

async function generateStitchedBaseTrack(
  apiKey: string,
  trackId: string,
  trackDir: string,
  outputFilename: string,
): Promise<void> {
  const prompts = SFX_STITCH_SEGMENTS[trackId];
  if (!prompts?.length) throw new Error(`No SFX stitch config for ${trackId}`);

  const segmentDir = join(trackDir, '.segments');
  mkdirSync(segmentDir, { recursive: true });
  const segmentPaths: string[] = [];

  console.log(`  SFX stitch: ${prompts.length} × 30s segments → ~${prompts.length * 30}s track`);

  for (let i = 0; i < prompts.length; i++) {
    const segmentPath = join(segmentDir, `segment-${String(i + 1).padStart(2, '0')}.mp3`);
    console.log(`  Segment ${i + 1}/${prompts.length}...`);
    const buffer = await generateSoundEffect(apiKey, prompts[i], 30);
    writeFileSync(segmentPath, Buffer.from(buffer));
    segmentPaths.push(segmentPath);
  }

  const outputPath = join(trackDir, outputFilename);
  stitchMp3Segments(segmentPaths, outputPath);
  console.log(`  Stitched ${outputFilename} (${(readFileSync(outputPath).byteLength / 1024 / 1024).toFixed(1)} MB)`);
}

async function generateBaseTrack(
  track: SeedTrack,
  apiKey: string,
  engine: GenerateOptions['engine'],
): Promise<'music' | 'sfx-stitch'> {
  const musicConfig = MUSIC_BY_TRACK[track.manifest.id];
  const trackDir = join(OUT_DIR, track.prefix);

  if (engine === 'sfx-stitch') {
    await generateStitchedBaseTrack(apiKey, track.manifest.id, trackDir, track.manifest.baseLoop);
    return 'sfx-stitch';
  }

  if (!musicConfig) throw new Error(`No music config for ${track.manifest.id}`);

  try {
    const musicBuffer = await generateMusicTrack(apiKey, musicConfig);
    writeFileSync(join(trackDir, track.manifest.baseLoop), Buffer.from(musicBuffer));
    console.log(
      `  Wrote ${track.manifest.baseLoop} (${(musicBuffer.byteLength / 1024 / 1024).toFixed(1)} MB) via Music API`,
    );
    return 'music';
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (engine === 'music' || status !== 402) throw err;

    console.warn('  Music API requires a paid ElevenLabs plan. Falling back to stitched SFX segments...');
    await generateStitchedBaseTrack(apiKey, track.manifest.id, trackDir, track.manifest.baseLoop);
    return 'sfx-stitch';
  }
}

async function generateSoundEffect(
  apiKey: string,
  prompt: string,
  durationSeconds: number,
): Promise<ArrayBuffer> {
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: durationSeconds,
      prompt_influence: 0.5,
      loop: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs SFX API error ${response.status}: ${text}`);
  }

  return response.arrayBuffer();
}

async function generateTrackFiles(track: SeedTrack, options: GenerateOptions): Promise<void> {
  const trackDir = join(OUT_DIR, track.prefix);
  mkdirSync(join(trackDir, 'chimes'), { recursive: true });

  if (!MUSIC_BY_TRACK[track.manifest.id] && !SFX_STITCH_SEGMENTS[track.manifest.id]) {
    throw new Error(`No generation config for ${track.manifest.id}`);
  }

  console.log(`Generating ${track.manifest.id}...`);

  if (options.dryRun) {
    const musicConfig = MUSIC_BY_TRACK[track.manifest.id];
    const stitchCount = SFX_STITCH_SEGMENTS[track.manifest.id]?.length ?? 0;
    if (musicConfig) {
      const totalSec = musicConfig.compositionPlan.chunks.reduce((s, c) => s + c.duration_ms, 0) / 1000;
      console.log(`  [dry-run] Music API: ${totalSec}s → ${track.manifest.baseLoop}`);
    }
    if (stitchCount) {
      console.log(`  [dry-run] SFX stitch fallback: ${stitchCount} × 30s → ${track.manifest.baseLoop}`);
    }
    if (!options.baseOnly) {
      for (const chime of track.manifest.chimePool) {
        console.log(`  [dry-run] Would generate chime: ${chime.id}`);
      }
    }
    writeFileSync(join(trackDir, 'manifest.json'), JSON.stringify(track.manifest, null, 2));
    return;
  }

  const method = await generateBaseTrack(track, options.apiKey, options.engine);
  console.log(`  Base track method: ${method}`);

  if (!options.baseOnly) {
    const chimePrompts = CHIME_PROMPTS[track.manifest.milieu];
    for (let i = 0; i < track.manifest.chimePool.length; i++) {
      const chime = track.manifest.chimePool[i];
      const chimePrompt = chimePrompts[i % chimePrompts.length];
      console.log(`  Generating chime: ${chime.id}...`);
      const chimeBuffer = await generateSoundEffect(options.apiKey, chimePrompt, 4);
      writeFileSync(join(trackDir, chime.file), Buffer.from(chimeBuffer));
    }
  }

  writeFileSync(join(trackDir, 'manifest.json'), JSON.stringify(track.manifest, null, 2));
  console.log(`  Done: ${trackDir}`);
}

function uploadFile(key: string, filePath: string, contentType: string): void {
  execSync(
    `npx wrangler r2 object put "${BUCKET}/${key}" --file="${filePath}" --content-type="${contentType}" --remote`,
    { stdio: 'inherit' },
  );
}

async function uploadTrack(track: SeedTrack, baseOnly: boolean): Promise<void> {
  const trackDir = join(OUT_DIR, track.prefix);

  uploadFile(`${track.prefix}/manifest.json`, join(trackDir, 'manifest.json'), 'application/json');

  const basePath = join(trackDir, track.manifest.baseLoop);
  if (existsSync(basePath)) {
    uploadFile(`${track.prefix}/${track.manifest.baseLoop}`, basePath, 'audio/mpeg');
  }

  if (!baseOnly) {
    for (const chime of track.manifest.chimePool) {
      const chimePath = join(trackDir, chime.file);
      if (existsSync(chimePath)) {
        uploadFile(`${track.prefix}/${chime.file}`, chimePath, 'audio/mpeg');
      }
    }
  }

  console.log(`  Uploaded ${track.manifest.id} to R2`);
}

async function main(): Promise<void> {
  loadEnvFile();

  const { milieu, tracks: trackIds, baseOnly, engine } = parseArgs();
  const selected = filterTracks(milieu, trackIds);

  if (selected.length === 0) {
    console.error('No tracks matched filters. Use --milieu=day or --tracks=day-zen-garden,...');
    process.exit(1);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const dryRun = !apiKey;

  if (dryRun) {
    console.log('ELEVENLABS_API_KEY not set — running in dry-run mode.');
  }

  console.log(`Tracks: ${selected.map((t) => t.manifest.id).join(', ')}`);
  console.log(`Engine: ${engine}`);
  if (baseOnly) console.log('Base-only mode: skipping chime generation');

  for (const track of selected) {
    await generateTrackFiles(track, { apiKey: apiKey ?? '', dryRun, baseOnly, engine });
    if (!dryRun) await uploadTrack(track, baseOnly);
  }

  const index = SEED_TRACKS.map(({ manifest }) => ({
    id: manifest.id,
    name: manifest.name,
    milieu: manifest.milieu,
  }));
  writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));

  if (!dryRun) {
    uploadFile('index.json', join(OUT_DIR, 'index.json'), 'application/json');
  }

  console.log('Complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
