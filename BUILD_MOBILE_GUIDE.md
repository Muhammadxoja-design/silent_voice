# Android va iOS build yo'riqnomasi

## 1) Eng tez variant: PWA sifatida ishlatish
Bu loyiha mobile-first va PWA-ready.

- Webga Render orqali deploy qiling.
- Android Chrome yoki iPhone Safari orqali oching.
- `Add to Home Screen` qiling.

Bu usul demo, test va pitch uchun yetarli.

## 2) Store-ready variant: Capacitor bilan o'rash

### Talablar
- Node.js 20+
- Android Studio
- Xcode (faqat macOS)

### Qadamlar
```bash
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init silent-voice com.silentvoice.demo
```

`capacitor.config.ts` yoki `capacitor.config.json` ichida web URL yoki webDir kiriting.

### Variant A: Deployed URLni WebView ichida ochish
```json
{
  "appId": "com.silentvoice.demo",
  "appName": "Silent Voice",
  "webDir": "www",
  "server": {
    "url": "https://YOUR-RENDER-APP.onrender.com",
    "cleartext": false
  }
}
```

### Android
```bash
npx cap add android
npx cap open android
```
Android Studio ichida:
- emulator yoki real device ulang
- Run bosing
- APK/AAB build qiling

### iOS
```bash
npx cap add ios
npx cap open ios
```
Xcode ichida:
- signing team tanlang
- simulator yoki iPhone tanlang
- Run bosing

## 3) Kameraga ruxsatlar
Android va iOS manifest/plist ichida camera, vibration, geolocation permissionlarni yoqing.

## 4) Keyingi professional bosqich
- Frontendni Expo/React Native yoki Flutterga ajrating
- Flask backendni API server sifatida qoldiring
- Gesture AI ni server-side yoki on-device model bilan ulang
