import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import client from '../api/client';

// Detect if running inside Expo Go — push notifications are not supported there since SDK 53
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export default function usePushNotifications(isEnabled) {
  useEffect(() => {
    // Skip entirely when running in Expo Go (push not supported)
    if (isExpoGo || !isEnabled) {
      return undefined;
    }

    let mounted = true;
    let notificationSubscription;
    let responseSubscription;

    const register = async () => {
      if (!Device.isDevice) {
        return;
      }

      const existing = await Notifications.getPermissionsAsync();
      let finalStatus = existing.status;
      if (existing.status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }

      if (finalStatus !== 'granted') {
        return;
      }

      try {
        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.expoProjectId || undefined,
        });
        if (!mounted || !tokenResponse?.data) {
          return;
        }
        await client.post('/auth/push-token/', {
          token: tokenResponse.data,
          platform: Platform.OS,
          device_name: Device.deviceName || '',
        });
      } catch (error) {
        Alert.alert('Push registration failed', 'The app could not register this device for notifications.');
      }
    };

    register();

    notificationSubscription = Notifications.addNotificationReceivedListener(() => {});
    responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      mounted = false;
      notificationSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [isEnabled]);
}
