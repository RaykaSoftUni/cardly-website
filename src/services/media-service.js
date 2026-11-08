import { supabaseClient } from './supabase-client.js';
const cache = new Map();
export async function publicAssetUrl(path) {
  if (!cache.has(path)) cache.set(path, (async () => {
    const { data, error } = await supabaseClient.storage.from('card-assets').download(path);
    if (error) throw error;
    return URL.createObjectURL(data);
  })());
  return cache.get(path);
}
window.addEventListener('pagehide', () => {
  for (const promise of cache.values()) promise.then(url => URL.revokeObjectURL(url)).catch(() => {});
  cache.clear();
});
