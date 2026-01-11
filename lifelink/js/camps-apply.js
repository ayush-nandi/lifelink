import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { 
    collection, addDoc, serverTimestamp, doc, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const applyForm = document.getElementById("applyForm");

// --- ADMIN AUTO-APPROVAL LOGIC ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        // Fetch user data to check role
        const userSnap = await getDoc(doc(db, "users", user.uid));
        
        if (userSnap.exists()) {
            const userData = userSnap.data();

            if (userData.role === "admin") {
                console.log("Admin detected. Checking Maker status...");

                // Check if Admin is already in the camp_makers collection
                const makerSnap = await getDoc(doc(db, "camp_makers", user.uid));

                if (!makerSnap.exists()) {
                    // Auto-grant Maker role to Admin in the database
                    await setDoc(doc(db, "camp_makers", user.uid), {
                        userId: user.uid,
                        role: "maker",
                        approvedAt: serverTimestamp(),
                        note: "Auto-approved as System Admin"
                    });
                    console.log("Admin auto-granted Maker access.");
                }

                // Redirect Admin directly to the dashboard
                window.location.href = "camps-dashboard.html";
            }
        }
    } catch (err) {
        console.error("Error checking admin status:", err);
    }
});

// --- STANDARD USER APPLICATION LOGIC ---
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
        organizationType: "N/A", 
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