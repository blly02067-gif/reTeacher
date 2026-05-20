// StudyFlow — Firebase + Auth + Firestore shared module
// Loaded via <script> tag on every page after the Firebase CDN scripts.

const SF_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCERrtTSgSrVxRO0jf5ZOXLRLHyG7UQ0C4",
  authDomain: "studyflow-32548.firebaseapp.com",
  projectId: "studyflow-32548",
  storageBucket: "studyflow-32548.firebasestorage.app",
  messagingSenderId: "58419725016",
  appId: "1:58419725016:web:71cdaa27ac0fed60374dad"
};

// ─── Init ────────────────────────────────────────────────────────────────────
firebase.initializeApp(SF_FIREBASE_CONFIG);
const sfAuth = firebase.auth();
const sfDb   = firebase.firestore();

// ─── Auth helpers ────────────────────────────────────────────────────────────
let sfUser = null;

function sfSignIn() {
  const provider = new firebase.auth.GoogleAuthProvider();
  sfAuth.signInWithPopup(provider).catch(err => console.error('Sign-in error', err));
}

function sfSignOut() {
  sfAuth.signOut().then(() => { sfUser = null; sfUpdateNavUI(null); });
}

// ─── Nav auth button injection ────────────────────────────────────────────────
// Each page's <nav> must contain <div id="sf-auth-slot"></div> before nav-spacer.
function sfUpdateNavUI(user) {
  const slot = document.getElementById('sf-auth-slot');
  if (!slot) return;
  if (user) {
    slot.innerHTML = `
      <div class="sf-user-chip">
        <img src="${user.photoURL || ''}" onerror="this.style.display='none'" class="sf-avatar" alt="">
        <span class="sf-user-name">${user.displayName ? user.displayName.split(' ')[0] : 'Account'}</span>
        <button class="sf-signout-btn" onclick="sfSignOut()">Sign out</button>
      </div>`;
  } else {
    slot.innerHTML = `
      <button class="sf-signin-btn" onclick="sfSignIn()">
        <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.6 0 6.7 5.5 2.9 13.5l7.8 6C12.5 13 17.8 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 6.9-10.1 6.9-17z"/>
          <path fill="#FBBC05" d="M10.7 28.5A14.4 14.4 0 0 1 9.5 24c0-1.6.3-3.1.8-4.5l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.8l8.2-6.3z"/>
          <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.5-4.2-13.3-9.9l-8.2 6.3C6.7 42.5 14.6 48 24 48z"/>
        </svg>
        Sign in with Google
      </button>`;
  }
}

// ─── Firestore data helpers ───────────────────────────────────────────────────
// Collection layout: users/{uid}/{collection}  (single doc "data" per collection)

async function sfSave(collection, data) {
  if (!sfUser) {
    localStorage.setItem('sf_' + collection, JSON.stringify(data));
    return;
  }
  try {
    await sfDb.collection('users').doc(sfUser.uid)
      .collection(collection).doc('data').set({ payload: JSON.stringify(data) });
    // Also keep localStorage in sync for instant reads
    localStorage.setItem('sf_' + collection, JSON.stringify(data));
  } catch (e) {
    console.warn('Firestore save failed, using localStorage', e);
    localStorage.setItem('sf_' + collection, JSON.stringify(data));
  }
}

async function sfLoad(collection, fallback) {
  if (!sfUser) {
    const raw = localStorage.getItem('sf_' + collection);
    return raw ? JSON.parse(raw) : fallback;
  }
  try {
    const doc = await sfDb.collection('users').doc(sfUser.uid)
      .collection(collection).doc('data').get();
    if (doc.exists && doc.data().payload) {
      const data = JSON.parse(doc.data().payload);
      localStorage.setItem('sf_' + collection, JSON.stringify(data)); // cache
      return data;
    }
  } catch (e) {
    console.warn('Firestore load failed, using localStorage', e);
  }
  const raw = localStorage.getItem('sf_' + collection);
  return raw ? JSON.parse(raw) : fallback;
}

// ─── Auth state listener ──────────────────────────────────────────────────────
// Pages can hook sfOnAuthReady(user) to re-init their data after sign-in.
let _sfAuthReadyCbs = [];
function sfOnAuthReady(cb) { _sfAuthReadyCbs.push(cb); }

sfAuth.onAuthStateChanged(user => {
  sfUser = user;
  sfUpdateNavUI(user);
  _sfAuthReadyCbs.forEach(cb => cb(user));
  // Expose premium status based on Firestore user doc
  if (user) {
    sfDb.collection('users').doc(user.uid).get().then(doc => {
      if (doc.exists && doc.data().premium) {
        localStorage.setItem('sf_premium', 'true');
      }
    }).catch(() => {});
  }
});
