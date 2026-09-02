// lib/safe-fetch.js
// Helper buat CEGAH SSRF sebelum server nge-fetch URL yang datanya dari
// input admin/user (mis. link thumbnail) -- bukan link yang server bikin
// sendiri. Tanpa ini, server bisa "disuruh" nge-fetch alamat internal
// (169.254.169.254 buat metadata cloud, 127.0.0.1, IP LAN, dst).
//
// Awalnya cuma ada di api/telegram-webhook.js (dipakai pas admin ganti
// thumbnail lewat link manual); dipindah ke sini biar api/og-image.js juga
// bisa pakai logic yang sama tanpa duplikasi.
//
// Catatan: ini best-effort (cek IP hasil resolve DNS saat ini), bukan
// proteksi 100% terhadap DNS-rebinding tingkat lanjut -- tapi cukup buat
// nutup celah paling umum.

import dns from 'dns/promises';
import net from 'net';

export function isPrivateOrReservedIp(ip) {
  if (net.isIPv6(ip)) {
    return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true; // format aneh -> tolak aja
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local, termasuk metadata cloud
  if (a === 0) return true;
  return false;
}

export async function assertSafeExternalUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('URL gak valid.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('URL harus http:// atau https://');
  }
  const hostname = parsed.hostname;
  if (hostname === 'localhost') throw new Error('URL nunjuk ke localhost, gak diizinkan.');

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Gagal resolve domain dari URL itu.');
  }
  if (!addresses.length || addresses.some(a => isPrivateOrReservedIp(a.address))) {
    throw new Error('URL nunjuk ke alamat internal/private, gak diizinkan.');
  }
}
