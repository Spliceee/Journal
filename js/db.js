/* ---------- Supabase-backed data layer ----------
 * Keeps the same DB.add/put/delete/get/getAll(storeName, ...) shape the rest of
 * the app already uses, but talks to Supabase Postgres instead of IndexedDB.
 * JS objects stay camelCase; rows in Postgres are snake_case — translated here
 * so no view file needs to know the difference.
 */

const TABLE_MAP = {
  diary: 'diary',
  exerciseCategories: 'exercise_categories',
  exerciseEntries: 'exercise_entries',
  gallery: 'gallery',
  tasks: 'tasks',
  taskCategories: 'task_categories',
};

const FIELD_TO_DB = { categoryId: 'category_id', createdAt: 'created_at' };
const FIELD_FROM_DB = { category_id: 'categoryId', created_at: 'createdAt' };

function toRow(obj) {
  const row = {};
  for (const [k, v] of Object.entries(obj)) row[FIELD_TO_DB[k] || k] = v;
  return row;
}
function fromRow(row) {
  const obj = {};
  for (const [k, v] of Object.entries(row)) obj[FIELD_FROM_DB[k] || k] = v;
  return obj;
}

async function settingsGet(key) {
  const { data, error } = await sb.auth.getUser();
  if (error) throw error;
  const meta = (data.user && data.user.user_metadata) || {};
  return key in meta ? { key, value: meta[key] } : undefined;
}
async function settingsPut(obj) {
  const { error } = await sb.auth.updateUser({ data: { [obj.key]: obj.value } });
  if (error) throw error;
  return obj;
}
/* Update several settings keys in one atomic auth.updateUser() call — firing
 * multiple settingsPut() calls concurrently races on the client's cached user
 * state and silently drops fields, so batch writes must go through here. */
async function setSettings(values) {
  const { error } = await sb.auth.updateUser({ data: values });
  if (error) throw error;
}

const DB = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  },
  async add(storeName, obj) {
    if (storeName === 'settings') return settingsPut(obj);
    const { error } = await sb.from(TABLE_MAP[storeName]).insert(toRow(obj));
    if (error) throw error;
    return obj;
  },
  async put(storeName, obj) {
    if (storeName === 'settings') return settingsPut(obj);
    const { error } = await sb.from(TABLE_MAP[storeName]).upsert(toRow(obj));
    if (error) throw error;
    return obj;
  },
  async delete(storeName, id) {
    if (storeName === 'settings') return;
    const { error } = await sb.from(TABLE_MAP[storeName]).delete().eq('id', id);
    if (error) throw error;
  },
  async get(storeName, id) {
    if (storeName === 'settings') return settingsGet(id);
    const { data, error } = await sb.from(TABLE_MAP[storeName]).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : undefined;
  },
  async getAll(storeName) {
    const { data, error } = await sb.from(TABLE_MAP[storeName]).select('*');
    if (error) throw error;
    return (data || []).map(fromRow);
  },
};

window.DB = DB;
