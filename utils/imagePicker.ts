import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { persistPhoto } from '@/utils/photoStorage';

// Both pickers return a URI in the app's cache directory, which iOS reclaims
// under storage pressure. persistPhoto copies it somewhere durable and returns
// the value to store; render it with resolvePhotoUri. See utils/photoStorage.ts.

export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Please allow access to your photo library to add images.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled && result.assets.length > 0) {
    return persistPhoto(result.assets[0].uri);
  }
  return null;
}

export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Please allow camera access to take photos.');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled && result.assets.length > 0) {
    return persistPhoto(result.assets[0].uri);
  }
  return null;
}

export function showImagePickerOptions(onPick: (uri: string) => void) {
  Alert.alert(
    'Add Photo',
    'Choose a source',
    [
      {
        text: 'Camera',
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) onPick(uri);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const uri = await pickImage();
          if (uri) onPick(uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]
  );
}
