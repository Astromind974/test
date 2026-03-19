/**
 * src/utils/ssrf.js
 * -----------------
 * Utilitaire de protection SSRF : vérifie qu'une URL pointe vers
 * une adresse IP publique et non vers une adresse privée/loopback.
 */

const dns = require("dns").promises;
const { isIP } = require("net");

/**
 * Détermine si une adresse IP est une adresse privée, loopback,
 * link-local ou multicast (non routable sur Internet).
 *
 * @param {string} ip - Adresse IPv4 sous forme de chaîne
 * @returns {boolean}
 */
function isPrivateIP(ip) {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;

  if (a === 10) return true;                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
  if (a === 192 && b === 168) return true;            // 192.168.0.0/16
  if (a === 127) return true;                         // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;            // 169.254.0.0/16 link-local
  if (a >= 224 && a <= 239) return true;              // 224.0.0.0/4 multicast
  if (a === 0) return true;                           // 0.0.0.0/8
  return false;
}

/**
 * Vérifie qu'une URL est sûre (ni adresse privée ni loopback).
 *
 * @param {string} url - URL à vérifier
 * @returns {Promise<boolean>}
 */
async function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (!hostname) return false;

    // Si le hostname est déjà une IP
    if (isIP(hostname) === 4) {
      return !isPrivateIP(hostname);
    }

    // Résolution DNS
    const addresses = await dns.resolve4(hostname);
    if (!addresses || addresses.length === 0) return false;
    return !isPrivateIP(addresses[0]);
  } catch {
    return false;
  }
}

module.exports = { isSafeUrl, isPrivateIP };
