import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Linking } from 'react-native';

/**
 * Take (or pick) a photo and keep a 1080 px copy in the app's documents folder,
 * where iOS doesn't clean it up. Used for progress photos and memories.
 */
export async function keepPhoto(name: string, camera = true): Promise<string | null> {
  if (camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) await Linking.openSettings();
      return null;
    }
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9 };
  const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const asset = res.canceled ? null : res.assets[0];
  if (!asset?.uri) return null;
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if ((asset.width ?? 0) > 1080) ctx.resize({ width: 1080 });
    const out = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });
    const dest = new File(Paths.document, `${name}.jpg`);
    if (dest.exists) dest.delete();
    new File(out.uri).copy(dest);
    return dest.uri;
  } catch (e) {
    console.warn('[fotos]', e);
    return asset.uri;
  }
}
