import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

function extractVendorId(value) {
  const text = String(value || '').trim();
  const match = text.match(/vendor\/(\d+)/i) || text.match(/\/vendors\/(\d+)/i);
  return match ? match[1] : null;
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionWrap}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>Allow camera access to scan a vendor QR code and open the rating screen directly.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : ({ data }) => {
          const vendorId = extractVendorId(data);
          setScanned(true);
          if (vendorId) {
            router.replace(`/vendor/${vendorId}`);
            return;
          }
          router.replace('/(tabs)/home');
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>Scan Vendor QR</Text>
        <Text style={styles.overlayText}>Point the camera at the shop QR code to open the vendor page.</Text>
        {scanned && (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScanned(false)}>
            <Text style={styles.primaryBtnText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24, backgroundColor: 'rgba(15,23,42,0.85)' },
  overlayTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  overlayText: { color: '#cbd5e1', lineHeight: 20, marginBottom: 16 },
  permissionWrap: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  permissionText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  primaryBtn: { backgroundColor: '#f97316', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
});
