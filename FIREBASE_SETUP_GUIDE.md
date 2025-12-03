# Firebase Setup Guide for OurShow

Follow these steps to set up the backend for your application.

## 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **"Add project"**.
3. Enter a project name (e.g., `OurShow-App`).
4. You can disable Google Analytics for now to save time.
5. Click **"Create project"**.

## 2. Register Your App
1. Once the project is ready, click the **Web icon (`</>`)** on the project overview page.
2. Register the app with a nickname (e.g., `OurShow Web`).
3. **Important:** You don't need to set up "Firebase Hosting" yet.
4. Click **"Register app"**.

## 3. Get Configuration
1. You will see a code block with `const firebaseConfig = { ... };`.
2. **Copy the entire `firebaseConfig` object** (everything inside the `{ }`).
3. Paste it into the chat so I can update your `config.js`.

## 4. Enable Authentication
1. In the Firebase Console sidebar, go to **Build > Authentication**.
2. Click **"Get started"**.
3. Go to the **Sign-in method** tab.
4. Enable **Email/Password**.
5. Enable **Google**.
   - You might need to select your support email (`krishacharya9797@gmail.com`).
6. Click **Save**.

## 5. Enable Firestore Database
1. In the sidebar, go to **Build > Firestore Database**.
2. Click **"Create database"**.
3. Choose a location (default is usually fine).
4. Start in **Test mode** (this allows read/write access for development).
5. Click **Create**.

---
**Next Step:** Please paste the `firebaseConfig` object here!
