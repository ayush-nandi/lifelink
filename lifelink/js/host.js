import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const form = document.getElementById("hostForm");

console.log("host.js loaded");

let currentUser = null;

/* AUTH CHECK */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("Please sign in first");
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
});

const formSection = document.getElementById("formSection");
const statusSection = document.getElementById("statusSection");
const backBtn = document.getElementById("backBtn");

/* SUBMIT */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    alert("Auth not ready, try again");
    return;
  }

  try {
    await addDoc(collection(db, "host_requests"), {
      userId: currentUser.uid,
      orgName: document.getElementById("orgName").value,
      orgType: document.getElementById("orgType").value,
      registrationId: document.getElementById("registrationId").value,
      donationType: document.getElementById("donationType").value,
      contact: document.getElementById("contact").value,
      status: "pending",
      createdAt: serverTimestamp()
    });

    // UI SWITCH
    formSection.classList.add("hidden");
    statusSection.classList.remove("hidden");
    backBtn.classList.remove("hidden");

  } catch (err) {
    console.error(err);
    alert("Submission failed. Check console.");
  }
});

/* BACK BUTTON */
backBtn.addEventListener("click", () => {
  window.location.href = "dashboard.html";
});
