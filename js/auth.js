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

let isSignUp = false;

toggleBtn.addEventListener("click", () => {
  isSignUp = !isSignUp;
  nameInput.classList.toggle("hidden", !isSignUp);
  submitBtn.textContent = isSignUp ? "Create Account" : "Sign In";
  toggleText.textContent = isSignUp ? "Already have an account?" : "Don’t have an account?";
  toggleBtn.textContent = isSignUp ? "Sign in" : "Sign up";
});

googleBtn.addEventListener("click", async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await handleUserDoc(result.user, result.user.displayName);
  } catch (err) {
    alert(err.message);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const name = nameInput.value;

  try {
    if (isSignUp) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await handleUserDoc(cred.user, name);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    }
  } catch (err) {
    alert(err.message);
  }
});

async function handleUserDoc(user, name) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: name || "Anonymous User",
      email: user.email,
      role: "user", // Standardized role
      credits: 0,
      createdAt: serverTimestamp()
    });
  }
  window.location.href = "dashboard.html";
}