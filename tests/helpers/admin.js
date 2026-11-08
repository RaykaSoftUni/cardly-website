import { loadEnv } from 'vite';
const env = loadEnv('development', process.cwd());
const host = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
export const adminId = 'd0000000-0000-4000-8000-000000000001';
const otherId = 'd0000000-0000-4000-8000-000000000002';
export const cardId = 'd0000000-0000-4000-8000-000000000003';
const uid = i => `d0000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
export const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGO4U7HgPwAHHAL0OMCbtQAAAABJRU5ErkJggg==', 'base64');
export async function mockAdmin(page, role = 'admin') {
  const user = { id: adminId, email: 'operator@example.test', aud: 'authenticated', user_metadata: { role: 'admin' }, app_metadata: { provider: 'email' } };
  const payload = Buffer.from(JSON.stringify({ sub: adminId, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url');
  await page.addInitScript(({ host, user, payload }) => localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: `test.${payload}.not-a-real-signature`, refresh_token: 'test-only-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in: 3600, token_type: 'bearer', user })), { host, user, payload });
  const state = { role, writes: [], uploads: [], reads: [], users: [{ id: adminId, email: user.email, display_name: 'Operator', role: 'admin', created_at: new Date().toISOString() }, { id: otherId, email: 'reader@example.test', display_name: 'Reader', role: 'user', created_at: new Date().toISOString() }],
    cards: [{ id: cardId, title: 'Protected card', slug: 'protected-card', description: 'A test catalog card', status: 'draft', pricing_type: 'free', price: null, currency: 'EUR', is_available: true, is_featured: false, sort_order: 0 }],
    categories: [{ id: uid(4), name: 'Elegant', slug: 'elegant', description: '', is_active: true, sort_order: 0 }],
    occasions: [{ id: uid(5), name: 'Birthday', slug: 'birthday', description: '', is_active: true, sort_order: 0 }],
    card_templates: [{ id: uid(6), card_id: cardId, template_key: 'protected', version: 1, layout_config: { regions: [] }, style_config: null }],
    personalization_fields: [{ id: uid(7), card_id: cardId, field_key: 'recipient_name', label: 'Recipient', field_type: 'text', is_required: true, sort_order: 0, config: { max_length: 60 } }, { id: uid(8), card_id: cardId, field_key: 'message', label: 'Message', field_type: 'textarea', is_required: false, sort_order: 1, config: {} }], card_images: [],
  };
  await page.route('**/auth/v1/user', route => route.fulfill({ json: user }));
  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const entity = url.pathname.split('/').pop();
    if (entity === 'user_roles') return route.fulfill({ json: [{ user_id: adminId, role: state.role }] });
    if (url.pathname.includes('/rpc/')) {
      const args = request.postDataJSON();
      if (entity === 'admin_list_users') return route.fulfill({ json: state.users });
      if (entity === 'admin_generated_metadata') return route.fulfill({ json: [{ id: uid(90), user_id: otherId, card_title: 'Snapshot title', template_version: 2, status: 'processing', created_at: new Date().toISOString() }] });
      state.writes.push({ entity, args });
      if (entity === 'admin_save_card_data') {
        if (args.p_data.slug === 'taken') return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate slug' } });
        const rows = state[args.p_entity];
        let row = rows.find(r => r.id === args.p_id);
        if (row) { Object.assign(row, args.p_data); if (args.p_entity === 'card_templates') row.version++; }
        else { row = { id: uid(100 + state.writes.length), ...args.p_data }; rows.push(row); }
        return route.fulfill({ json: row });
      }
      if (entity === 'admin_remove_configuration') state[args.p_entity] = state[args.p_entity].filter(r => r.id !== args.p_id);
      if (entity === 'admin_reorder_fields') args.p_field_ids.forEach((id, i) => state.personalization_fields.find(f => f.id === id).sort_order = i);
      if (entity === 'admin_set_user_role') state.users.find(u => u.id === args.p_user_id).role = args.p_role;
      return route.fulfill({ json: true });
    }
    state.reads.push(entity);
    const rows = state[entity] || [];
    const id = url.searchParams.get('id')?.replace('eq.', '');
    const card = url.searchParams.get('card_id')?.replace('eq.', '');
    const selected = rows.filter(row => (!id || row.id === id) && (!card || row.card_id === card));
    return route.fulfill({ json: request.headers().accept?.includes('vnd.pgrst.object') ? selected[0] : selected });
  });
  await page.route('**/storage/v1/object/**', route => {
    const request = route.request();
    if (request.url().includes('/list/')) return route.fulfill({ json: [] });
    if (request.method() === 'GET') return route.fulfill({ contentType: 'image/png', body: png });
    if (request.method() === 'POST') state.uploads.push(request.url());
    return route.fulfill({ json: { Key: 'card-assets/test.png', Id: uid(99) } });
  });
  return state;
}
