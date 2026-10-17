// Voiceover for every segment of script.json, with word timings, plus the timeline the Remotion
// composition reads (public/vo/timeline.json). Run from video/: pnpm run voiceover
// TTS_PROVIDER: elevenlabs (default), openai, or files (your own recordings at public/vo/<id>.wav).
// Unchanged segments are reused, so a re-run after an edit only pays for the edited segments.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

type Scene = "hook" | "step" | "image" | "end";
type Segment = {
  id: string;
  scene: Scene;
  text: string;
  onScreen?: string;
  image?: string;
};
type Script = {
  title: string;
  sponsor: string;
  url: string;
  targetSeconds: number;
  segments: Segment[];
};
type Word = { text: string; start: number; end: number };
type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

const RATE = 24_000; // both APIs return 16-bit mono PCM at 24 kHz in the formats requested below
const WORDS_PER_SECOND = 2.2;
const GAP = 0.35;
const MIN_STEP = 3.2;
const END_HOLD = 1.5;
const HOOK_MAX = 8; // seconds: judges decide in the first seconds, and all 10 WebMCP winners showed the product by 6 s
const provider = process.env.TTS_PROVIDER ?? "elevenlabs";
const script = JSON.parse(readFileSync("script.json", "utf8")) as Script;

function need(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(
      `${name} is missing: add it to video/.env.local (see video/.env.example).`,
    );
  return value;
}

function wavFromPcm(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function wavSeconds(path: string): number {
  const wav = readFileSync(path);
  if (
    wav.toString("ascii", 0, 4) !== "RIFF" ||
    wav.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error(`${path} is not a WAV file`);
  let byteRate = 0;
  for (let at = 12; at + 8 <= wav.length;) {
    const id = wav.toString("ascii", at, at + 4);
    const size = wav.readUInt32LE(at + 4);
    if (id === "fmt ") byteRate = wav.readUInt32LE(at + 16);
    if (id === "data" && byteRate > 0)
      return Math.min(size, wav.length - at - 8) / byteRate;
    at += 8 + size + (size % 2);
  }
  throw new Error(`${path} has no PCM audio data`);
}

function wordsFromAlignment(alignment: Alignment): Word[] {
  const words: Word[] = [];
  let current: Word | null = null;
  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    if (/\s/.test(char)) {
      current = null;
      continue;
    }
    if (current === null) {
      current = {
        text: "",
        start: alignment.character_start_times_seconds[i],
        end: 0,
      };
      words.push(current);
    }
    current.text += char;
    current.end = alignment.character_end_times_seconds[i];
  }
  return words;
}

// Without timestamps (OpenAI, own recordings), words are spread by length over the audio.
function estimatedWords(text: string, seconds: number): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const total = tokens.reduce((sum, token) => sum + token.length + 1, 0);
  let at = 0;
  return tokens.map((token) => {
    const start = (at / total) * seconds;
    at += token.length + 1;
    return { text: token, start, end: (at / total) * seconds };
  });
}

async function elevenlabs(
  index: number,
): Promise<{ wav: Buffer; words: Word[] }> {
  const base = process.env.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io";
  const response = await fetch(
    `${base}/v1/text-to-speech/${need("ELEVENLABS_VOICE_ID")}/with-timestamps?output_format=pcm_24000`,
    {
      method: "POST",
      headers: {
        "xi-api-key": need("ELEVENLABS_API_KEY"),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: script.segments[index].text,
        model_id: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
        previous_text: script.segments[index - 1]?.text,
        next_text: script.segments[index + 1]?.text,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      `ElevenLabs returned ${response.status}: ${(await response.text()).slice(0, 400)}`,
    );
  const data = (await response.json()) as {
    audio_base64: string;
    alignment: Alignment | null;
  };
  return {
    wav: wavFromPcm(Buffer.from(data.audio_base64, "base64")),
    words: data.alignment ? wordsFromAlignment(data.alignment) : [],
  };
}

async function openai(index: number): Promise<{ wav: Buffer; words: Word[] }> {
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const response = await fetch(`${base}/audio/speech`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${need("OPENAI_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE ?? "marin",
      input: script.segments[index].text,
      instructions:
        "A calm, confident product-demo narrator. Clear and unhurried, warm but not salesy. Even pace, no dramatic pauses.",
      response_format: "pcm",
    }),
  });
  if (!response.ok)
    throw new Error(
      `OpenAI returned ${response.status}: ${(await response.text()).slice(0, 400)}`,
    );
  return {
    wav: wavFromPcm(Buffer.from(await response.arrayBuffer())),
    words: [],
  };
}

async function main(): Promise<void> {
  if (!["elevenlabs", "openai", "files"].includes(provider))
    throw new Error(
      `TTS_PROVIDER must be elevenlabs, openai or files, not "${provider}"`,
    );
  const target = script.targetSeconds;
  const totalWords = script.segments.reduce(
    (sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length,
    0,
  );
  const budget = Math.floor(target * WORDS_PER_SECOND);
  if (totalWords > budget * 1.1) {
    throw new Error(
      `script.json has ${totalWords} words; ${target} s holds about ${budget}. Cut ${totalWords - budget} words before generating or recording.`,
    );
  }
  const hookWords = script.segments
    .filter((s) => s.scene === "hook")
    .reduce((sum, s) => sum + s.text.split(/\s+/).filter(Boolean).length, 0);
  const hookBudget = Math.floor(HOOK_MAX * WORDS_PER_SECOND);
  if (hookWords > hookBudget * 1.1) {
    throw new Error(
      `The hook has ${hookWords} words; ${HOOK_MAX} s holds about ${hookBudget}. Cut ${hookWords - hookBudget} words before generating or recording.`,
    );
  }

  mkdirSync("public/vo", { recursive: true });
  const voice =
    provider === "elevenlabs"
      ? `${need("ELEVENLABS_VOICE_ID")}/${process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2"}`
      : provider === "openai"
        ? (process.env.OPENAI_TTS_VOICE ?? "marin")
        : "own";
  const used = new Set(["timeline.json"]);
  const segments = [];
  let cursor = 0;
  for (const [index, segment] of script.segments.entries()) {
    let name = segment.id;
    let words: Word[] = [];
    if (provider === "files") {
      if (!existsSync(`public/vo/${name}.wav`))
        throw new Error(
          `Record segment "${segment.id}" and save it as video/public/vo/${name}.wav`,
        );
    } else {
      name = `${segment.id}-${createHash("sha256").update(`${provider}|${voice}|${segment.text}`).digest("hex").slice(0, 10)}`;
      if (
        existsSync(`public/vo/${name}.wav`) &&
        existsSync(`public/vo/${name}.words.json`)
      ) {
        words = JSON.parse(
          readFileSync(`public/vo/${name}.words.json`, "utf8"),
        ) as Word[];
      } else {
        const speech =
          provider === "elevenlabs"
            ? await elevenlabs(index)
            : await openai(index);
        writeFileSync(`public/vo/${name}.wav`, speech.wav);
        writeFileSync(
          `public/vo/${name}.words.json`,
          JSON.stringify(speech.words),
        );
        words = speech.words;
        console.log(`  generated ${segment.id}`);
      }
      used.add(`${name}.words.json`);
    }
    used.add(`${name}.wav`);
    const audioSec = wavSeconds(`public/vo/${name}.wav`);
    if (words.length === 0) words = estimatedWords(segment.text, audioSec);
    const durationSec = Math.max(
      audioSec + (segment.scene === "end" ? END_HOLD : GAP),
      segment.scene === "step" ? MIN_STEP : 0,
    );
    segments.push({
      ...segment,
      file: `vo/${name}.wav`,
      startSec: cursor,
      audioSec,
      durationSec,
      words,
    });
    cursor += durationSec;
  }
  if (provider !== "files") {
    for (const file of readdirSync("public/vo"))
      if (!used.has(file)) rmSync(`public/vo/${file}`);
  }

  const timeline = {
    provider,
    title: script.title,
    sponsor: script.sponsor,
    url: script.url,
    targetSeconds: target,
    totalSec: cursor,
    segments,
  };
  writeFileSync(
    "public/vo/timeline.json",
    `${JSON.stringify(timeline, null, 2)}\n`,
  );
  for (const s of segments) {
    console.log(
      `  ${s.id.padEnd(16)} ${s.scene.padEnd(6)} ${String(s.text.split(/\s+/).length).padStart(3)} words  audio ${s.audioSec.toFixed(1).padStart(5)} s  slot ${s.durationSec.toFixed(1).padStart(5)} s`,
    );
  }
  console.log(
    `Total ${cursor.toFixed(1)} s of ${target} s (${totalWords} words, ${provider}).`,
  );
  const hook = segments.find((s) => s.scene === "hook");
  if (hook && hook.durationSec > HOOK_MAX) {
    throw new Error(
      `The hook runs ${hook.durationSec.toFixed(1)} s, over the ${HOOK_MAX} s cap: cut about ${Math.ceil((hook.durationSec - HOOK_MAX) * WORDS_PER_SECOND)} words from it and run again.`,
    );
  }
  if (cursor > target) {
    throw new Error(
      `Over by ${(cursor - target).toFixed(1)} s: cut about ${Math.ceil((cursor - target) * WORDS_PER_SECOND)} words from the longest segments and run again.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
