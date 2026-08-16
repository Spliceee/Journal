/* ---------- Supabase client ---------- */
const SUPABASE_URL = 'https://bdwjubflsqjqltjifpxf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RRZs2Ta9EaTvfSdy3t3-nA_xyaMfQuv';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;

const PHOTO_BUCKET = 'photos';

/* Public URL for a stored photo {id, path}. Synchronous — just builds a URL, no network call. */
function photoUrl(photo) {
  if (!photo || !photo.path) return null;
  return sb.storage.from(PHOTO_BUCKET).getPublicUrl(photo.path).data.publicUrl;
}

/* Resize + upload a File to the current user's folder in Storage. Returns {id, path}. */
async function uploadPhoto(file) {
  const blob = await fileToResizedBlob(file);
  const { data: { session } } = await sb.auth.getSession();
  const id = DB.uid();
  const path = `${session.user.id}/${id}.jpg`;
  const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return { id, path };
}
