import {
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  StreamType,
  entersState,
  type AudioPlayer,
} from "@discordjs/voice";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { EdgeTTS } from "node-edge-tts";

export interface TtsResult {
  ok: boolean;
  error?: string;
}

export interface PlayTtsOptions {
  onStart?: () => void;
}

export const TTS_VOICES = {
  th: "th-TH-NiwatNeural",
  en: "en-US-AndrewNeural",
  ja: "ja-JP-KeitaNeural",
} as const;

export type TtsLanguage = keyof typeof TTS_VOICES;

export function detectLanguage(text: string): TtsLanguage {
  if (/[぀-ヿ㐀-䶿一-鿿]/.test(text)) return "ja";
  if (/[฀-๿]/.test(text)) return "th";
  return "en";
}

export function getLangFromVoice(voice: string): string {
  const match = /^([a-z]{2,3}-[A-Z]{2})/i.exec(voice);
  if (match) return match[1];
  return "th-TH";
}

export function pickVoice(text: string, explicit?: string | null): string {
  if (explicit && explicit.trim()) return explicit.trim();
  return TTS_VOICES[detectLanguage(text)];
}

export function cleanTextForTts(text: string): string {
  return text
    // Replace URLs with "ลิงก์"
    .replace(/https?:\/\/\S+/gi, " ลิงก์ ")
    // Replace custom emojis <:name:id> or <a:name:id> with :name:
    .replace(/<a?:(\w+):\d+>/g, " $1 ")
    // Replace user mentions <@!id> or <@id>
    .replace(/<@!?\d+>/g, " ")
    // Replace channel mentions <#id>
    .replace(/<#\d+>/g, " ")
    // Replace role mentions <@&id>
    .replace(/<@&\d+>/g, " ")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();
}

export const TTS_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
export const TTS_RETRIES = 3;
export const TTS_ATTEMPT_TIMEOUT_MS = 10000;
export const MIN_AUDIO_BYTES = 500;
export const PLAY_TIMEOUT_MS = 60000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${Math.round(ms / 1000)}s`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export interface SynthResult {
  path?: string;
  error?: string;
}

export async function synthesizeTts(text: string, voice: string): Promise<SynthResult> {
  const clean = cleanTextForTts(text);
  if (!clean) {
    return { error: "ไม่มีข้อความสำหรับพูด" };
  }

  // Cap length to prevent unbounded synthesis delays
  const truncated = clean.length > 400 ? clean.slice(0, 400) : clean;
  const lang = getLangFromVoice(voice);

  let lastError: string | null = null;

  for (let attempt = 0; attempt < TTS_RETRIES; attempt++) {
    const tempPath = path.join(os.tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
    try {
      const tts = new EdgeTTS({
        voice,
        lang,
        outputFormat: TTS_OUTPUT_FORMAT,
        timeout: TTS_ATTEMPT_TIMEOUT_MS,
      });

      await withTimeout(tts.ttsPromise(truncated, tempPath), TTS_ATTEMPT_TIMEOUT_MS + 2000);

      const size = fs.existsSync(tempPath) ? fs.statSync(tempPath).size : 0;
      if (size < MIN_AUDIO_BYTES) {
        throw new Error(`ไฟล์เสียงมีขนาดเล็กเกินไป (${size} bytes)`);
      }
      return { path: tempPath };
    } catch (e) {
      lastError = (e as Error).message ?? String(e);
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
      if (attempt < TTS_RETRIES - 1) {
        await sleep(1000);
      }
    }
  }

  return { error: lastError ?? "เกิดข้อผิดพลาดในการสังเคราะห์เสียง" };
}

function scheduleCleanup(filePath: string, delayMs: number): void {
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore
    }
  }, delayMs);
}

// Per-guild persistent AudioPlayer
const guildPlayers = new Map<string, AudioPlayer>();

export function getOrCreatePlayer(guildId: string): AudioPlayer {
  let player = guildPlayers.get(guildId);
  if (!player) {
    player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
        maxMissedFrames: 250,
      },
    });
    guildPlayers.set(guildId, player);
  }
  return player;
}

export function cleanupGuildPlayer(guildId: string): void {
  const player = guildPlayers.get(guildId);
  if (player) {
    player.stop(true);
    guildPlayers.delete(guildId);
  }
  guildQueues.delete(guildId);
}

// Per-guild playback queue
const guildQueues = new Map<string, Promise<void>>();

async function executePlayTts(
  text: string,
  voice: string | null,
  guildId: string,
  options?: PlayTtsOptions
): Promise<TtsResult> {
  const resolvedVoice = pickVoice(text, voice);
  const connection = getVoiceConnection(guildId);
  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    return { ok: false, error: "ไม่มีการเชื่อมต่อห้องเสียง" };
  }

  // Ensure connection is Ready
  if (connection.state.status !== VoiceConnectionStatus.Ready) {
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (e) {
      return { ok: false, error: "การเชื่อมต่อห้องเสียงไม่พร้อมใช้งาน (not ready)" };
    }
  }

  const synth = await synthesizeTts(text, resolvedVoice);
  if (synth.error || !synth.path) {
    return { ok: false, error: `TTS สังเคราะห์เสียงล้มเหลว: ${synth.error}` };
  }

  const tempPath = synth.path;
  const player = getOrCreatePlayer(guildId);

  // Subscribe connection to the player
  connection.subscribe(player);

  return new Promise<TtsResult>((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      scheduleCleanup(tempPath, 2000);
    };

    const finish = (result: TtsResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    timer = setTimeout(() => {
      player.stop(true);
      finish({ ok: false, error: "เล่นเสียงหมดเวลา (timeout)" });
    }, PLAY_TIMEOUT_MS);

    let started = false;
    const onStartPlaying = () => {
      if (started) return;
      started = true;
      try {
        options?.onStart?.();
      } catch (e) {
        console.error("[tts] onStart callback error:", e);
      }
    };

    player.once(AudioPlayerStatus.Playing, () => {
      onStartPlaying();
    });

    player.once(AudioPlayerStatus.Idle, () => {
      finish({ ok: true });
    });

    player.once("error", (error) => {
      console.error("[tts] player error:", error);
      finish({ ok: false, error: `เล่นเสียงไม่สำเร็จ: ${error.message}` });
    });

    connection.once("error", (error) => {
      console.error("[tts] voice connection error:", error);
      finish({ ok: false, error: `การเชื่อมต่อเสียงมีข้อผิดพลาด: ${error.message}` });
    });

    try {
      const resource = createAudioResource(tempPath, {
        inputType: StreamType.Arbitrary,
      });

      resource.playStream.once("error", (error) => {
        console.error("[tts] resource stream error:", error);
        finish({ ok: false, error: `ถอดรหัสเสียงไม่สำเร็จ: ${error.message}` });
      });

      player.play(resource);

      setImmediate(() => {
        if (player.state.status === AudioPlayerStatus.Playing) {
          onStartPlaying();
        }
      });
    } catch (err) {
      console.error("[tts] createAudioResource error:", err);
      finish({ ok: false, error: `ไม่สามารถเริ่มเล่นเสียงได้: ${(err as Error).message}` });
    }
  });
}

export async function playTts(
  text: string,
  voice: string | null,
  guildId: string,
  options?: PlayTtsOptions
): Promise<TtsResult> {
  const previous = guildQueues.get(guildId) ?? Promise.resolve();

  const current = previous
    .catch(() => {})
    .then(async () => {
      return await executePlayTts(text, voice, guildId, options);
    });

  const queuePromise = current.then(
    () => {},
    () => {}
  );
  guildQueues.set(guildId, queuePromise);

  try {
    return await current;
  } finally {
    if (guildQueues.get(guildId) === queuePromise) {
      guildQueues.delete(guildId);
    }
  }
}
