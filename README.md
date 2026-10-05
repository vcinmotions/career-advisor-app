# smart-skills-india LMS Mobile App

Production-ready Udemy-like LMS mobile application built with:
- React Native
- Expo
- TypeScript
- Zustand
- TanStack Query
- Axios
- React Navigation
- NativeWind

## Setup

```bash
npm install
npx expo start
```

## Environment

Create `.env`:

```env
EXPO_PUBLIC_SMART_SKILLS_API_URL=https://your-api.com/api/v1
```

Use the same API origin as the Smart Skills web app. Android emulators use the local backend alias during development; physical devices and production builds must set this variable to a reachable HTTPS API URL. Production builds fail fast when it is missing.
