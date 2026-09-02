// api/survey.js
// Gabungan 4 endpoint survey yang sebelumnya file terpisah (survey-page.js, survey-submit.js,
// survey-results.js, survey-thumbnail.js) -- digabung jadi SATU serverless function karena
// Vercel Hobby cuma boleh maksimal 12 function per deployment, dan project ini sempat
// kelebihan (13 file) sampai bikin deploy gagal diam-diam di tahap "Deploying outputs...".
//
// URL publik yang lama (dipakai frontend & og:image bot preview) TETAP jalan persis sama --
// cuma "dialihkan" ke sini lewat rewrites di vercel.json (mis. /api/survey-submit jadi
// /api/survey?mode=submit). Jadi gak ada satupun kode frontend yang perlu diubah.
//
// Dispatch berdasarkan ?mode=:
//   mode=page      -> GET, render halaman /survey/ (dulu survey-page.js)
//   mode=submit    -> POST, terima jawaban survey (dulu survey-submit.js)
//   mode=results   -> GET, agregat hasil poling khusus admin (dulu survey-results.js)
//   mode=thumbnail -> GET, serve bytes thumbnail buat og:image (dulu survey-thumbnail.js)

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkAdminAuth } from '../lib/admin-auth.js';
import { alertRateLimitHit } from '../lib/spam-alert.js';

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

const SITE_URL = 'https://afi-studio.vercel.app';

export default async function handler(req, res) {
  const mode = req.query && req.query.mode;
  switch (mode) {
    case 'submit': return handleSubmit(req, res);
    case 'results': return handleResults(req, res);
    case 'thumbnail': return handleThumbnail(req, res);
    case 'page':
    default: return handlePage(req, res);
  }
}

// ===========================================================================
// mode=page -- dulu api/survey-page.js
// Merender halaman /survey/ (dengan atau tanpa ?id=) secara dinamis di server, supaya bot
// preview link (WhatsApp, Discord, dll -- yang gak menjalankan JavaScript) tetap bisa baca
// judul & deskripsi survey yang benar dari tag <meta property="og:*">.
// ===========================================================================

const DEFAULT_TITLE = 'Survey & Polling - Afi Studio';
const DEFAULT_DESC = 'Ikut serta dalam survey dan polling dari komunitas Afi Studio. Lihat daftar survey yang sedang berjalan dan bagikan pendapatmu.';
const DEFAULT_IMAGE = `${SITE_URL}/thumbnail.webp`;

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function handlePage(req, res) {
  const id = req.query && req.query.id;
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESC;
  let ogImage = DEFAULT_IMAGE;
  let ogUrl = `${SITE_URL}/survey/`;

  if (id && redis) {
    try {
      const surveys = await redis.get('afi-studio:data:surveys');
      const survey = Array.isArray(surveys) ? surveys.find(s => s.id === id) : null;
      if (survey) {
        title = `${survey.title} - Survey Afi Studio`;
        description = survey.description && survey.description.trim() ? survey.description : DEFAULT_DESC;
        ogUrl = `${SITE_URL}/survey/?id=${encodeURIComponent(id)}`;
        // Thumbnail survey: kalau diisi lewat Link, langsung dipakai sebagai og:image.
        // Kalau diisi lewat Upload (disimpan sebagai data: URI di Redis), arahkan ke
        // /api/survey-thumbnail (mode=thumbnail) yang men-decode & nge-serve bytes-nya
        // lewat URL asli, karena bot preview (WhatsApp dll) gak bisa baca data: URI di meta tag.
        // Kalau kosong, tetap pakai gambar bawaan (DEFAULT_IMAGE).
        const thumb = survey.thumbnail && String(survey.thumbnail).trim();
        if (thumb) {
          ogImage = thumb.startsWith('data:')
            ? `${SITE_URL}/api/survey-thumbnail?id=${encodeURIComponent(id)}`
            : thumb;
        }
      } else {
        title = 'Link Survey Tidak Valid - Afi Studio';
      }
    } catch (e) {
      console.error('Gagal ambil data survey buat meta tag:', e.message);
    }
  }

  let template;
  try {
    template = fs.readFileSync(path.join(process.cwd(), 'survey', 'template.html'), 'utf8');
  } catch (e) {
    console.error('Gagal baca template survey:', e.message);
    return res.status(500).send('Gagal memuat halaman survey.');
  }

  const html = template
    .split('%%PAGE_TITLE%%').join(escapeHtml(title))
    .split('%%OG_TITLE%%').join(escapeHtml(title))
    .split('%%OG_DESC%%').join(escapeHtml(description))
    .split('%%OG_URL%%').join(escapeHtml(ogUrl))
    .split('%%OG_IMAGE%%').join(escapeHtml(ogImage));

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(html);
}

// ===========================================================================
// mode=submit -- dulu api/survey-submit.js
// Endpoint publik buat nerima jawaban survey dari pengunjung.
//
// Lapisan proteksi (urutan eksekusi):
//   1. Rate limiting umum (Upstash, sliding window 10x/10 menit per IP) -- nyegah spam volume tinggi.
//   2. Cek survey ada & belum kadaluarsa.
//   3. Cek IP belum pernah submit ke survey ini (set "voters" per survey, bukan sliding window --
//      ini permanen selama survey masih ada, beda sama rate limit di atas yang cuma sementara).
//   4. Validasi jawaban server-side terhadap definisi pertanyaan (wajib diisi, opsi valid, dll).
//
// Data jawaban disimpan pakai Redis LIST (rpush), bukan JSON blob yang di-overwrite tiap kali --
// supaya aman kalau ada beberapa orang submit hampir bersamaan (tiap rpush atomic, gak akan
// saling menimpa kayak pola get-modify-set).
// ===========================================================================

// IP disimpan dalam bentuk hash (bukan mentah) -- cukup buat cek "sudah pernah isi atau belum",
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

async function handleSubmit(req, res) {
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
        alertRateLimitHit(redis, 'survey-submit', clientIp).catch(() => {}); // fire-and-forget
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
  let liveResults = null;
  if (survey.showResultsAfterSubmit) {
    try {
      const raw = await redis.lrange(`afi-studio:survey:responses:${surveyId}`, 0, -1);
      liveResults = aggregateResults(questions, raw);
    } catch (e) {
      console.error('Gagal hitung hasil live:', e.message);
    }
  }

  return res.status(200).json({ success: true, results: liveResults });
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

// ===========================================================================
// mode=results -- dulu api/survey-results.js
// Endpoint khusus admin panel buat ambil hasil poling 1 survey (agregat, bukan raw semua jawaban
// mentah tiap kali panel dibuka). Wajib header "x-admin-token", sama kayak POST di api/data/[type].js.
// ===========================================================================

async function handleResults(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  const auth = await checkAdminAuth(req);
  if (!auth.ok) {
    return res.status(401).json({ error: 'Token admin salah atau belum login.' });
  }
  if (!redis) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: database kosong.' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Parameter "id" wajib diisi.' });

  let surveys;
  try {
    surveys = await redis.get('afi-studio:data:surveys');
  } catch (e) {
    return res.status(500).json({ error: 'Gagal mengambil data survey.' });
  }
  const survey = Array.isArray(surveys) ? surveys.find(s => s.id === id) : null;
  if (!survey) return res.status(404).json({ error: 'Survey tidak ditemukan.' });

  let raw;
  try {
    raw = await redis.lrange(`afi-studio:survey:responses:${id}`, 0, -1);
  } catch (e) {
    console.error('Gagal ambil jawaban survey:', e.message);
    return res.status(500).json({ error: 'Gagal mengambil jawaban survey.' });
  }

  const parsed = (raw || []).map(r => {
    try { return typeof r === 'string' ? JSON.parse(r) : r; } catch { return null; }
  }).filter(Boolean);

  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  const questionResults = questions.map(q => {
    if (q.type === 'single' || q.type === 'multiple') {
      const counts = {};
      (q.options || []).forEach(o => { counts[o.id] = 0; });
      for (const resp of parsed) {
        const ans = (resp.answers || []).find(a => a.questionId === q.id);
        if (!ans) continue;
        const vals = q.type === 'multiple' ? (Array.isArray(ans.value) ? ans.value : []) : [ans.value].filter(Boolean);
        for (const v of vals) { if (counts[v] !== undefined) counts[v]++; }
      }
      return { questionId: q.id, text: q.text, type: q.type, options: q.options || [], counts };
    }
    const texts = [];
    for (const resp of parsed) {
      const ans = (resp.answers || []).find(a => a.questionId === q.id);
      if (ans && typeof ans.value === 'string' && ans.value.trim()) {
        texts.push({ value: ans.value.trim(), submittedAt: resp.submittedAt });
      }
    }
    return { questionId: q.id, text: q.text, type: q.type, texts };
  });

  return res.status(200).json({
    surveyId: id,
    title: survey.title,
    totalResponses: parsed.length,
    questions: questionResults,
  });
}

// ===========================================================================
// mode=thumbnail -- dulu api/survey-thumbnail.js
// Thumbnail survey yang diupload lewat panel admin disimpan sebagai data: URI (base64) di
// dalam data survey (sama seperti gambar pertanyaan). Itu cukup buat ditampilkan langsung
// lewat <img> di halaman survey/panel admin (JS jalan, browser bisa baca data: URI).
//
// Tapi bot preview link (WhatsApp, Discord, dll) yang mengambil og:image / twitter:image TIDAK
// menjalankan JavaScript dan TIDAK bisa memuat data: URI dari meta tag -- mereka butuh URL
// http(s) beneran buat di-fetch. Mode ini men-decode data: URI tadi dari Redis dan
// men-serve isinya sebagai response gambar biasa lewat URL, supaya og:image tetap valid.
//
// Kalau thumbnail-nya diisi lewat opsi "Link Gambar" di admin, mode ini gak dipakai --
// mode=page langsung pakai link tersebut sebagai og:image.
// ===========================================================================

const DATA_URI_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

async function handleThumbnail(req, res) {
  const id = req.query && req.query.id;
  if (!id || !redis) {
    return res.status(404).send('Not found');
  }

  try {
    const surveys = await redis.get('afi-studio:data:surveys');
    const survey = Array.isArray(surveys) ? surveys.find(s => s.id === id) : null;
    const thumb = survey && survey.thumbnail;

    if (!thumb || typeof thumb !== 'string') {
      return res.status(404).send('Not found');
    }

    const match = DATA_URI_RE.exec(thumb.trim());
    if (!match) {
      return res.status(404).send('Not found');
    }

    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600');
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('Gagal ambil thumbnail survey:', e.message);
    return res.status(500).send('Error');
  }
}
