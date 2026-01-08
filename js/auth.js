import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const googleBtn = document.getElementById("googleSignInBtn");
const form = document.getElementById("emailAuthForm");
const toggleBtn = document.getElementById("toggleMode");
const toggleText = document.getElementById("toggleText");
const submitBtn = document.getElementById("submitBtn");
const nameInput = document.getElementById("name");
const formTitle = document.getElementById("formTitle");

let isSignUp = false;

/* ---------- UI TOGGLE ---------- */
toggleBtn.addEventListener("click", () => {
  isSignUp = !isSignUp;
  nameInput.classList.toggle("hidden", !isSignUp);
  formTitle.innerText = isSignUp ? "Join LifeLink" : "Welcome Back";
  submitBtn.innerText = isSignUp ? "Create Account" : "Sign In";
  toggleText.innerText = isSignUp ? "Already a member?" : "Don’t have an account?";
  toggleBtn.innerText = isSignUp ? "Login here" : "Create an account";
});

/* ---------- GOOGLE AUTH ---------- */
googleBtn.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await handleUserSetup(result.user, result.user.displayName);
  } catch (err) {
    alert(err.message);
  }
});

/* ---------- EMAIL AUTH ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const name = nameInput.value;

  try {
    if (isSignUp) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await handleUserSetup(cred.user, name);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      // SUCCESS: Always go to index.html as per your logic
      window.location.href = "index.html";
    }
  } catch (err) {
    alert(err.message);
  }
});

/* ---------- FIRESTORE SYNC ---------- */
async function handleUserSetup(user, name) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: name || "User",
      email: user.email,
      role: "user", // Standardized 'user' role for Grand version
      credits: 0,
      createdAt: serverTimestamp()
    });
  }
  // Redirect back to Landing Page after setup
  window.location.href = "index.html";
}