import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

// Retourne { url, error } pour que l'appelant gère l'affichage de l'erreur
export async function uploadImage(
  uri: string,
  bucket: 'beer-photos' | 'avatars',
  path: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const ext = uri.toLowerCase().endsWith('png') ? 'png' : 'jpg';
    const uploadPath = `${path}.${ext}`;

    let localUri = uri;
    if (uri.startsWith('content://')) {
      const cacheUri = `${FileSystem.cacheDirectory}upload_${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: uri, to: cacheUri });
      localUri = cacheUri;
    }

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64 || base64.length === 0) {
      return { url: null, error: 'Fichier vide ou illisible' };
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(uploadPath, decode(base64), {
        contentType: `image/${ext}`,
        upsert: true,
      });

    if (uri.startsWith('content://') && localUri !== uri) {
      FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => {});
    }

    if (error) {
      return { url: null, error: `Supabase: ${error.message}` };
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(uploadPath);
    return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
  } catch (e: any) {
    return { url: null, error: `Exception: ${e?.message ?? String(e)}` };
  }
}
