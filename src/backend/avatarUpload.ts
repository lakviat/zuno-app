import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { randomUUID } from 'expo-crypto';
import { supabase } from './client';
/** PHPicker selects one image without broad library access. Strip metadata and bound dimensions. */
export async function pickAvatar(userId: string): Promise<string | null> {
  const client = supabase;
  if (!client) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    exif: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  const largest = Math.max(asset.width, asset.height);
  if (largest > 512) context.resize(asset.width >= asset.height ? { width: 512 } : { height: 512 });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.8,
    base64: true,
  });
  context.release();
  rendered.release();
  if (!image.base64) throw new Error('Could not prepare your photo. Try another image.');
  const binary = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
  if (binary.byteLength > 5 * 1024 * 1024) throw new Error('Choose a smaller image.');
  const {
    data: { session },
  } = await client.auth.getSession();
  if (session?.user.id !== userId) throw new Error('Please sign in again.');
  const path = `${userId}/${randomUUID()}.jpg`;
  const { error } = await client.storage
    .from('zuno-avatars')
    .upload(path, binary.buffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error('Could not upload your photo. You can skip it and try later.');
  return path;
}
