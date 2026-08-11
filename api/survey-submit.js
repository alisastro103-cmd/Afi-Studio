// api/survey-submit.js
// Endpoint publik buat nerima jawaban survey dari pengunjung.
//
// Lapisan proteksi (urutan eksekusi):
//   1. Rate limiting umum (Upstash, sliding window 10x/10 menit per IP) — nyegah spam volume tinggi.
//   2. Cek survey ada & belum kadaluarsa.
//   3. Cek IP belum pernah submit ke survey ini (set "voters" per survey, bukan sliding window —
//      ini permanen selama survey masih ada, beda sama rate limit di atas yang cuma sementara).
//   4. Validasi jawaban server-side terhadap definisi pertanyaan (wajib diisi, opsi valid, dll).
//
// Data jawaban disimpan pakai Redis LIST (rpush), bukan JSON blob yang di-overwrite tiap kali —
// supaya aman kalau ada beberapa orang submit hampir bersamaan (tiap rpush atomic, gak akan
// saling menimpa kayak pola get-modify-set).

import crypto from 'crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 m'),
      analytics: true,
      prefix: 'afi-studio:survey-submit',
    })
  : null;

// IP disimpan dalam bentuk hash (bukan mentah) — cukup buat cek "sudah pernah isi atau belum",
// tanpa perlu nyimpen alamat IP asli pengunjung di database.
function hashIp(ip, surveyId) {
  const salt = process.env.ADMIN_TOKEN || 'afi-studio-survey-salt';
  return crypto.createHash('sha256').update(`${salt}:${surveyId}:${ip}`).digest('hex');
}

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

// Validasi 1 jawaban terhadap definisi pertanyaannya. Return string pesan error, atau null kalau valid.
function validateAnswer(question, answer) {
  const value = answer ? answer.value : undefined;

  if (question.type === 'single') {
    if (question.required && isBlank(value)) return `Pertanyaan "${question.text}" wajib diisi.`;
    if (!isBlank(value)) {
      const validIds = (question.options || []).map(o => o.id);
      if (!validIds.includes(value)) return `Opsi tidak valid untuk pertanyaan "${question.text}".`;
    }
  } else if (question.type === 'multiple') {
    const arr = Array.isArray(value) ? value : [];
    if (question.required && arr.length === 0) return `Pertanyaan "${question.text}" wajib diisi.`;
    const validIds = (question.options || []).map(o => o.id);
    if (arr.some(v => !validIds.includes(v))) return `Opsi tidak valid untuk pertanyaan "${question.text}".`;
  } else if (question.type === 'short_text' || question.type === 'long_text') {
    if (question.required && isBlank(value)) return `Pertanyaan "${question.text}" wajib diisi.`;
    if (typeof value === 'string') {
      const maxLen = question.type === 'short_text' ? 300 : 3000;
      if (value.length > maxLen) return `Jawaban "${question.text}" terlalu panjang.`;
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  if (!redis) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: database kosong.' });
  }

  const clientIp = (req.headers['x-forwarded-for'] || '127.0.0.1').split(',')[0].trim();

  // === 1. RATE LIMIT UMUM ===
  if (ratelimit) {
    try {
      const { success, reset } = await ratelimit.limit(clientIp);
      if (!success) {
        const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      }
    } catch (e) {
      console.error('Rate limit check gagal, request tetap dilanjutkan:', e.message);
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Body request bukan JSON yang valid.' }); }
  }
  const surveyId = body && body.surveyId;
  const answers = (body && Array.isArray(body.answers)) ? body.answers : [];

  if (isBlank(surveyId)) {
    return res.status(400).json({ error: 'surveyId wajib diisi.' });
  }

  // === 2. AMBIL DEFINISI SURVEY & CEK KADALUARSA ===
  let surveys;
  try {
    surveys = await redis.get('afi-studio:data:surveys');
  } catch (e) {
    console.error('Gagal ambil data survey:', e.message);
    return res.status(500).json({ error: 'Gagal mengambil data survey.' });
  }
  const survey = Array.isArray(surveys) ? surveys.find(s => s.id === surveyId) : null;
  if (!survey) {
    return res.status(404).json({ error: 'Survey tidak ditemukan.' });
  }
  if (survey.expiresAt && new Date(survey.expiresAt).getTime() <= Date.now()) {
    return res.status(410).json({ error: 'Survey ini sudah ditutup.' });
  }

  // === 3. CEK DUPLIKAT (1 IP cuma boleh 1x per survey) ===
  const voterHash = hashIp(clientIp, surveyId);
  const votersKey = `afi-studio:survey:voters:${surveyId}`;
  try {
    const already = await redis.sismember(votersKey, voterHash);
    if (already) {
      return res.status(409).json({ error: 'Kamu sudah pernah mengisi survey ini.' });
    }
  } catch (e) {
    console.error('Gagal cek voter:', e.message);
    return res.status(500).json({ error: 'Gagal memverifikasi. Coba lagi.' });
  }

  // === 4. VALIDASI JAWABAN ===
  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  const answerMap = {};
  for (const a of answers) { if (a && a.questionId) answerMap[a.questionId] = a; }

  for (const q of questions) {
    const err = validateAnswer(q, answerMap[q.id]);
    if (err) return res.status(400).json({ error: err });
  }

  // Susun ulang jawaban yang bersih (cuma questionId + value yang relevan) sebelum disimpan,
  // supaya data yang masuk gak sembarangan/kepanjangan.
  const cleanAnswers = questions.map(q => ({
    questionId: q.id,
    type: q.type,
    value: answerMap[q.id] ? answerMap[q.id].value : (q.type === 'multiple' ? [] : ''),
  }));

  const responseEntry = {
    submittedAt: new Date().toISOString(),
    answers: cleanAnswers,
  };

  // === 5. SIMPAN ===
  try {
    await redis.rpush(`afi-studio:survey:responses:${surveyId}`, JSON.stringify(responseEntry));
    await redis.sadd(votersKey, voterHash);
  } catch (e) {
    console.error('Gagal menyimpan jawaban survey:', e.message);
    return res.status(500).json({ error: 'Gagal menyimpan jawaban. Coba lagi.' });
  }

  // Kalau survey diatur buat langsung nampilin hasil setelah submit, hitung agregat ringan di sini
  // biar frontend gak perlu request kedua.
  let results = null;
  if (survey.showResultsAfterSubmit) {
    try {
      const raw = await redis.lrange(`afi-studio:survey:responses:${surveyId}`, 0, -1);
      results = aggregateResults(questions, raw);
    } catch (e) {
      console.error('Gagal hitung hasil live:', e.message);
    }
  }

  return res.status(200).json({ success: true, results });
}

function aggregateResults(questions, rawResponses) {
  const parsed = rawResponses.map(r => {
    try { return typeof r === 'string' ? JSON.parse(r) : r; } catch { return null; }
  }).filter(Boolean);

  return questions.map(q => {
    if (q.type === 'single' || q.type === 'multiple') {
      const counts = {};
      (q.options || []).forEach(o => { counts[o.id] = 0; });
      for (const resp of parsed) {
        const ans = (resp.answers || []).find(a => a.questionId === q.id);
        if (!ans) continue;
        const vals = q.type === 'multiple' ? (Array.isArray(ans.value) ? ans.value : []) : [ans.value].filter(Boolean);
        for (const v of vals) { if (counts[v] !== undefined) counts[v]++; }
      }
      return { questionId: q.id, type: q.type, counts, total: parsed.length };
    }
    // short_text / long_text -> kumpulkan teksnya
    const texts = [];
    for (const resp of parsed) {
      const ans = (resp.answers || []).find(a => a.questionId === q.id);
      if (ans && typeof ans.value === 'string' && ans.value.trim()) texts.push(ans.value.trim());
    }
    return { questionId: q.id, type: q.type, texts, total: parsed.length };
  });
}
