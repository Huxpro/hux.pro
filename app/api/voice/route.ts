import { experimental_transcribe as transcribe, gateway } from "ai";

export const maxDuration = 30;

const MODEL = "openai/whisper-1";
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

function available() {
  return process.env.VOICE_TRANSCRIPTION_MODEL !== "off" &&
    !!(process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export function GET() {
  return Response.json({ enabled: available(), model: available() ? MODEL : null }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!available()) return Response.json({ error: "Voice transcription is unavailable" }, { status: 503 });

  const type = request.headers.get("content-type")?.split(";")[0];
  if (!type || !["audio/webm", "audio/mp4", "audio/ogg"].includes(type)) {
    return Response.json({ error: "Unsupported audio format" }, { status: 415 });
  }
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_AUDIO_BYTES) return Response.json({ error: "Audio is too large" }, { status: 413 });
  const audio = new Uint8Array(await request.arrayBuffer());
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Audio is empty or too large" }, { status: 413 });
  }

  try {
    const result = await transcribe({
      model: gateway.transcriptionModel(MODEL),
      audio,
      abortSignal: AbortSignal.timeout(25_000),
    });
    return Response.json({ text: result.text.trim() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Voice transcription failed", error);
    return Response.json({ error: "Could not transcribe audio" }, { status: 502 });
  }
}
