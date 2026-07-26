/* Firebase configuration for the request-submission feature.
 *
 * The requests feature needs somewhere to store what clients submit.
 * Everything ELSE in the portal (boards, hours, progress, keywords) works
 * WITHOUT this — if you leave the placeholders below, the request form just
 * shows a "not set up yet" note and nothing breaks.
 *
 * ── HOW TO FILL THIS IN (one time, ~10 minutes) ──────────────────────────
 * See FIREBASE-SETUP.md in the repo root for the full walkthrough. Short version:
 *   1. Go to https://console.firebase.google.com → Add project (free "Spark" plan).
 *   2. Build → Firestore Database → Create database → Start in production mode.
 *   3. Project settings (gear icon) → "Your apps" → Web app (</>) → register.
 *   4. Copy the firebaseConfig values it shows you into the object below.
 *   5. Paste the security rules from FIREBASE-SETUP.md into Firestore → Rules.
 *   6. Commit + push. The request form goes live.
 */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCBahZ8L8tvpNeznG2T_U7RMR9LqjFNO70",
  authDomain: "client-project-tracking-cca98.firebaseapp.com",
  projectId: "client-project-tracking-cca98",
  storageBucket: "client-project-tracking-cca98.firebasestorage.app",
  messagingSenderId: "1039247411822",
  appId: "1:1039247411822:web:769af2c1176dd2d3bd347f"
};
