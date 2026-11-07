# Biscuit CRM - Native Cross-Platform Runtime Blueprint

This directory provides configurations to compile Biscuit CRM into native desktop and mobile binaries, eliminating browser sandbox constraints and providing native background sync.

### 1. Native Desktop App (Tauri / Rust)
Compile into a native 10MB binary with guaranteed eviction-immune disk storage:
```bash
npm install -D @tauri-apps/cli
npx tauri init
npx tauri build
```

### 2. Native Mobile Apps (Capacitor / iOS & Android)
Compile into native mobile apps with camera barcode scanner access:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/camera
npx cap init "Biscuit CRM" "com.biscuit.crm" --web-dir "out"
npx cap add android
npx cap add ios
npx cap open android
```
