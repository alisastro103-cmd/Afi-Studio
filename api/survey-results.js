// api/survey-results.js
// Endpoint khusus admin panel buat ambil hasil poling 1 survey (agregat, bukan raw semua jawaban
// mentah tiap kali panel dibuka). Wajib header "x-admin-token", sama kayak POST di api/data/[type].js.
//
// GET /api/survey-results?id=xxx

import { Redis } from '@upstash/redis';
import { requireAdmin } from '../lib/admin-auth.js';

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: ADMIN_TOKEN kosong.' });
  }
  const auth = await requireAdmin(req, res);
  if (!auth.ok) {
    return res.status(auth.status || 401).json({ error: auth.error });
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
