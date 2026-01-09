import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import {
  collection, query, where, onSnapshot, doc, writeBatch, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const stockGrid = document.getElementById("stockGrid");
const stockForm = document.getElementById("stockForm");
const modal = document.getElementById("stockModal");
const loadingIndicator = document.getElementById("loadingIndicator");
const dynamicInputsList = document.getElementById("dynamicInputsList");

/* -----------------------------------------------------------
   1. AUTH & LIVE LISTENER
   ----------------------------------------------------------- */
onAuthStateChanged(auth, (user) => {
  if (user) initLiveStock(user.uid);
  else window.location.href = "login.html";
});

function initLiveStock(uid) {
  const q = query(collection(db, "organizerStock"), where("orgId", "==", uid));
  onSnapshot(q, (snap) => {
    loadingIndicator.style.display = "none";
    stockGrid.innerHTML = "";
    if (snap.empty) {
      stockGrid.innerHTML = `<div class="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200"><p class="text-slate-400 font-bold uppercase tracking-widest text-xs">No active stock listed.</p></div>`;
      return;
    }
    snap.forEach(d => renderStockCard(d));
  });
}

function renderStockCard(d) {
  const data = d.data();
  const card = document.createElement("div");
  card.className = "bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative group animate-in fade-in zoom-in duration-300";
  card.innerHTML = `
    <button onclick="deleteItem('${d.id}')" class="absolute top-6 right-6 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-600 transition-all font-black text-[10px] tracking-widest">REMOVE</button>
    <div class="flex items-center gap-4 mb-4">
      <div class="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-xl">🩸</div>
      <div>
        <h4 class="text-2xl font-black text-slate-900">${data.bloodGroup}</h4>
        <p class="text-[9px] font-black text-red-600 uppercase tracking-widest">${data.category}</p>
      </div>
    </div>
    <div class="flex justify-between items-end mt-6">
      <div><span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Units</span><p class="text-3xl font-black text-slate-900">${data.units}</p></div>
      <p class="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Sync: ${data.lastUpdated ? new Date(data.lastUpdated.toDate()).toLocaleDateString() : 'Now'}</p>
    </div>`;
  stockGrid.appendChild(card);
}

/* -----------------------------------------------------------
   2. DYNAMIC INPUT GENERATOR (MULTI-QUANTITY)
   ----------------------------------------------------------- */
document.querySelectorAll('.group-checkbox').forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    const selected = Array.from(document.querySelectorAll('.group-checkbox:checked'));
    
    if (selected.length === 0) {
      dynamicInputsList.innerHTML = `<p class="text-slate-300 text-xs italic py-4">Select blood groups above to define stock levels...</p>`;
      return;
    }

    dynamicInputsList.innerHTML = "";
    selected.forEach(cb => {
      const div = document.createElement("div");
      div.className = "bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between";
      div.innerHTML = `
        <span class="font-black text-slate-900 text-sm">${cb.value} Group</span>
        <input type="number" name="qty_${cb.value}" placeholder="Units" class="w-24 p-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-red-500 font-bold text-center" required min="0">
      `;
      dynamicInputsList.appendChild(div);
    });
  });
});

/* -----------------------------------------------------------
   3. BATCH SUBMISSION
   ----------------------------------------------------------- */
stockForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  const category = document.getElementById("category").value;
  const selectedGroups = Array.from(document.querySelectorAll('.group-checkbox:checked'));
  const uid = auth.currentUser.uid;

  submitBtn.disabled = true;
  submitBtn.innerText = "Syncing Batch...";

  const batch = writeBatch(db);
  selectedGroups.forEach(cb => {
    const bloodGroup = cb.value;
    const units = parseInt(document.querySelector(`input[name="qty_${bloodGroup}"]`).value);
    
    // Custom ID: OrgID_Category_BloodGroup
    const stockId = `${uid}_${category}_${bloodGroup}`.replace(/\+/g, "pos").replace(/\-/g, "neg");
    const stockRef = doc(db, "organizerStock", stockId);

    batch.set(stockRef, {
      orgId: uid,
      category,
      bloodGroup,
      units,
      lastUpdated: serverTimestamp()
    });
  });

  try {
    await batch.commit();
    toggleModal(false);
    stockForm.reset();
    dynamicInputsList.innerHTML = `<p class="text-slate-300 text-xs italic py-4">Select blood groups above to define stock levels...</p>`;
  } catch (err) {
    alert("Batch Sync Failed: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Confirm and Push to Live";
  }
});

/* -----------------------------------------------------------
   4. GLOBAL EXPOSURE
   ----------------------------------------------------------- */
window.toggleModal = (show) => {
  modal.classList.toggle("hidden", !show);
  modal.classList.toggle("flex", show);
};

window.deleteItem = async (id) => {
  if (confirm("Permanently remove this resource?")) await deleteDoc(doc(db, "organizerStock", id));
};