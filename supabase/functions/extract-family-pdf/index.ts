// Supabase Edge Function: extract-family-pdf
//
// Keeps the AI provider key server-side. The browser sends only the prompt and
// the target family ID; this function verifies the caller is an active admin of
// that family before calling Groq or Gemini.
//
// Required Supabase secret:
//   GROQ_API_KEY   (preferred)  or  GEMINI_API_KEY
//
// Optional secrets:
//   AI_PROVIDER    'gemini' or 'groq' (defaults to gemini; the other is a fallback)
//   GROQ_MODEL     default: openai/gpt-oss-120b
//   GEMINI_MODEL   default: gemini-3.5-flash-lite
//   GEMINI_MODEL_FALLBACKS default: gemini-3.6-flash,gemini-3.8-flash
//
// Deploy:
//   supabase functions deploy extract-family-pdf
//
// The function is invoked from the app with supabase.functions.invoke().

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_PROMPT_CHARS = 300_000;

interface RequestBody {
  familyId?: string;
  prompt?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const model = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert genealogist. Extract family information and return ONLY valid JSON, no markdown, no explanations.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    throw new Error(`Groq ${response.status}: ${detail}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

async function callGemini(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 32768,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    throw new Error(`Gemini ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part: { text?: string }) => part.text ?? '').join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    const body = (await req.json()) as RequestBody;
    const familyId = body.familyId?.trim();
    const prompt = body.prompt ?? '';

    if (!familyId) {
      return json({ error: 'familyId is required' }, 400);
    }
    if (!prompt.trim()) {
      return json({ error: 'prompt is required' }, 400);
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return json(
        { error: `Prompt is too large (${prompt.length} chars).` },
        413,
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: 'Supabase function environment is incomplete' }, 500);
    }

    // Caller-scoped client: RLS and get_user_family_role run as the user.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { data: role, error: roleError } = await userClient.rpc(
      'get_user_family_role',
      { target_family_id: familyId },
    );

    if (roleError) {
      return json({ error: `Role check failed: ${roleError.message}` }, 500);
    }
    if (role !== 'admin') {
      return json({ error: 'Admin access required for this family' }, 403);
    }

    const groqKey = Deno.env.get('GROQ_API_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const preferred = (Deno.env.get('AI_PROVIDER') || 'gemini').toLowerCase();

    const primaryGeminiModel =
      Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
    const geminiFallbacks = (
      Deno.env.get('GEMINI_MODEL_FALLBACKS') ||
      'gemini-3.6-flash,gemini-3.8-flash'
    )
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);

    const geminiModels = Array.from(
      new Set([primaryGeminiModel, ...geminiFallbacks]),
    );

    type Attempt =
      | { provider: 'gemini'; model: string }
      | { provider: 'groq' };

    const attempts: Attempt[] = [];

    const addGeminiAttempts = () => {
      if (!geminiKey) return;
      geminiModels.forEach((model) =>
        attempts.push({ provider: 'gemini', model }),
      );
    };
    const addGroqAttempt = () => {
      if (groqKey) attempts.push({ provider: 'groq' });
    };

    if (preferred === 'groq') {
      addGroqAttempt();
      addGeminiAttempts();
    } else {
      addGeminiAttempts();
      addGroqAttempt();
    }

    if (attempts.length === 0) {
      return json(
        {
          error:
            'No AI key configured. Set GROQ_API_KEY or GEMINI_API_KEY as a Supabase Edge Function secret.',
        },
        500,
      );
    }

    const providerErrors: string[] = [];

    for (const attempt of attempts) {
      const label =
        attempt.provider === 'gemini'
          ? `gemini:${attempt.model}`
          : 'groq';

      try {
        const text =
          attempt.provider === 'gemini'
            ? await callGemini(prompt, geminiKey!, attempt.model)
            : await callGroq(prompt, groqKey!);

        if (text.trim()) {
          return json({ text, provider: label });
        }

        providerErrors.push(`${label}: empty response`);
      } catch (providerError) {
        const message =
          providerError instanceof Error
            ? providerError.message
            : String(providerError);
        providerErrors.push(`${label}: ${message}`);
        console.warn(
          `[extract-family-pdf] ${label} failed; trying the next attempt:`,
          message,
        );
      }
    }

    return json(
      { error: `All AI providers failed: ${providerErrors.join(' | ')}` },
      502,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[extract-family-pdf]', message);
    return json({ error: message }, 500);
  }
});
