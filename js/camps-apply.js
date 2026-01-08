import { auth, db } from "./firebase.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const applyForm = document.getElementById("applyForm");

applyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector("button");
    submitBtn.disabled = true;
    submitBtn.innerText = "Processing...";

    const data = {
        userId: auth.currentUser.uid,
        creatorName: document.getElementById("creatorName").value,
        creatorPhone: document.getElementById("creatorPhone").value,
        creatorEmail: auth.currentUser.email,
        creatorAddress: document.getElementById("creatorAddress").value,
        organizationName: document.getElementById("orgName").value,
        organizationType: "N/A", // Flexible
        govtIdType: document.getElementById("govtIdType").value,
        govtIdNumber: document.getElementById("govtIdNumber").value,
        status: "pending",
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "camp_maker_requests"), data);
        alert("Application submitted for review!");
        window.location.href = "camps-dashboard.html";
    } catch (err) {
        alert("Error: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit Application";
    }
});