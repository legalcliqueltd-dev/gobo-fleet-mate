import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

export interface CapturedMedia {
  dataUrl: string;
  file?: File;
  format: string;
}

/**
 * Check if running on a native platform (iOS/Android)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the current platform
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  const platform = Capacitor.getPlatform();
  return platform as 'ios' | 'android' | 'web';
}

/**
 * Request camera permissions on native platforms
 */
export async function requestCameraPermissions(): Promise<boolean> {
  if (!isNativePlatform()) {
    return true; // Web handles permissions automatically
  }

  try {
    const result = await Camera.requestPermissions({
      permissions: ['camera', 'photos'],
    });
    return result.camera === 'granted' || result.camera === 'limited';
  } catch (error) {
    console.error('Error requesting camera permissions:', error);
    return false;
  }
}

/**
 * Check camera permissions
 */
export async function checkCameraPermissions(): Promise<boolean> {
  if (!isNativePlatform()) {
    return true;
  }

  try {
    const result = await Camera.checkPermissions();
    return result.camera === 'granted' || result.camera === 'limited';
  } catch (error) {
    console.error('Error checking camera permissions:', error);
    return false;
  }
}

/**
 * Capture a photo using the native camera or fall back to web input
 * @param source - 'camera' for live camera, 'gallery' for photo library
 */
export async function capturePhoto(
  source: 'camera' | 'gallery' = 'camera'
): Promise<CapturedMedia | null> {
  if (!isNativePlatform()) {
    // Return null to signal web fallback should be used
    return null;
  }

  try {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      throw new Error('Camera permission denied');
    }

    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      saveToGallery: false,
      correctOrientation: true,
      width: 1920,
      height: 1920,
    });

    if (!photo.dataUrl) {
      throw new Error('No photo data received');
    }

    return {
      dataUrl: photo.dataUrl,
      format: photo.format || 'jpeg',
    };
  } catch (error: any) {
    // User cancelled is not an error
    if (error.message?.includes('User cancelled') || error.message?.includes('cancelled')) {
      console.log('User cancelled photo capture');
      return null;
    }
    console.error('Error capturing photo:', error);
    throw error;
  }
}

/**
 * Convert a data URL to a File object
 */
export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
}

/**
 * Helper to capture and convert to File in one call
 */
export async function capturePhotoAsFile(
  source: 'camera' | 'gallery' = 'camera'
): Promise<File | null> {
  const result = await capturePhoto(source);
  if (!result) return null;

  const timestamp = Date.now();
  const fileName = `photo_${timestamp}.${result.format}`;
  return dataUrlToFile(result.dataUrl, fileName);
}
