import { auth, db } from './firebase.js'; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { collection, query, getDocs, doc, getDoc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let allShops = [];
let currentShopId = null;

// --- 1. AUTH & ADMIN CHECK ---
onAuthStateChanged(auth, async (user) => {
    const loader = document.getElementById('fullPageLoader');
    const loaderText = document.getElementById('loaderText');

    if (user) {
        console.log("User logged in:", user.email);
        loaderText.innerText = "Checking permissions...";

        try {
            // Check if user is admin in Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userDocRef);

            // FIX: Ensure we handle cases where user doc might be missing or role isn't 'admin'
            if (userSnap.exists() && userSnap.data().role === 'admin') {
                console.log("Admin access granted.");
                
                // Update Sidebar
                document.getElementById('adminEmailDisplay').innerText = user.email;
                if(userSnap.data().name) document.getElementById('adminNameDisplay').innerText = userSnap.data().name;

                // Load Data
                await loadDashboardData();
                loader.style.display = 'none'; // Hide Loader ONLY after success
            } else {
                console.warn("User is not admin. Role:", userSnap.exists() ? userSnap.data().role : "No Doc");
                alert("ACCESS DENIED: You do not have administrator privileges.");
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error("Auth Check Failed:", error);
            alert("Error verifying admin status: " + error.message);
            window.location.href = "index.html";
        }
    } else {
        console.log("No user logged in. Redirecting...");
        window.location.href = "index.html";
    }
});

// --- 2. FETCH DATA ---
async function loadDashboardData() {
    const tableBody = document.getElementById('shopsTableBody');
    document.getElementById('loaderText').innerText = "Fetching shop data...";

    try {
        const q = query(collection(db, "shops"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        
        allShops = [];
        let pendingCount = 0;
        let approvedCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            allShops.push({ id: doc.id, ...data });
            if(data.status === 'pending') pendingCount++;
            if(data.status === 'approved') approvedCount++;
        });

        console.log(`Loaded ${allShops.length} shops.`);

        // Update Stats
        document.getElementById('countTotal').innerText = allShops.length;
        document.getElementById('countPending').innerText = pendingCount;
        document.getElementById('countApproved').innerText = approvedCount;

        renderTable(allShops);

    } catch (error) {
        console.error("Data Load Error:", error);
        tableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center; padding:20px;">Error loading data: ${error.message}</td></tr>`;
    }
}

// --- 3. RENDER TABLE ---
function renderTable(shops) {
    const tableBody = document.getElementById('shopsTableBody');
    tableBody.innerHTML = "";

    if (shops.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:20px;">No applications found.</td></tr>`;
        return;
    }

    shops.forEach(shop => {
        const row = document.createElement('tr');
        
        const badgeClass = shop.status === 'approved' ? 'badge-approved' : 'badge-pending';
        const dateStr = shop.createdAt ? new Date(shop.createdAt.seconds*1000).toLocaleDateString() : 'N/A';

        row.innerHTML = `
            <td>
                <strong>${shop.name}</strong><br>
                <small style="color:#999; font-family:monospace;">ID: ${shop.id.substr(0,6)}...</small>
            </td>
            <td>${shop.address}<br><small style="color:#666">${shop.pincode}</small></td>
            <td>${shop.phone}<br><small style="color:#666">${shop.ownerEmail}</small></td>
            <td style="color:#666;">${dateStr}</td>
            <td><span class="status-badge ${badgeClass}">${shop.status}</span></td>
            <td>
                <button class="btn-icon" onclick="openShopDetails('${shop.id}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// --- 4. MODAL LOGIC ---
// Attach to window so HTML can call it
window.openShopDetails = function(shopId) {
    const shop = allShops.find(s => s.id === shopId);
    if (!shop) return;
    
    currentShopId = shopId;
    document.getElementById('modalTitle').innerText = shop.name;
    document.getElementById('modalId').innerText = "ID: " + shopId;
    
    const body = document.getElementById('modalBody');
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lon}`;

    body.innerHTML = `
        <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid #eee;">
            <div class="detail-row" style="margin-bottom:5px;">
                <div><span class="detail-label">Status</span><br> <b style="color:${shop.status==='approved'?'green':'orange'}">${shop.status.toUpperCase()}</b></div>
                <div><span class="detail-label">Open 24/7</span><br> ${shop.isOpen247 ? '✅ YES' : '❌ NO'}</div>
            </div>
        </div>

        <h4 style="border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:15px; color:#2E7D32;">Official Licenses</h4>
        <div class="detail-row">
            <div><span class="detail-label">Drug License</span><br> <span class="detail-value" style="color:#d32f2f">${shop.dlNum}</span></div>
            <div><span class="detail-label">GSTIN</span><br> <span class="detail-value" style="color:#1976d2">${shop.gstin}</span></div>
        </div>
        <div class="detail-row">
            <div><span class="detail-label">Owner PAN</span><br> <span class="detail-value">${shop.panNum}</span></div>
        </div>

        <div style="text-align:center; margin-top:25px;">
            <a href="${mapLink}" target="_blank" style="text-decoration:none; color:#2E7D32; font-weight:700; border:1px solid #2E7D32; padding:8px 20px; border-radius:50px;">
                <i class="fas fa-map-marker-alt"></i> Check Location on Maps
            </a>
        </div>
    `;

    // Toggle Buttons
    const btnApprove = document.getElementById('btnApprove');
    const btnReject = document.getElementById('btnReject');
    
    if(shop.status === 'approved') {
        btnApprove.style.display = 'none';
        btnReject.innerText = "Revoke License";
    } else {
        btnApprove.style.display = 'inline-block';
        btnReject.innerText = "Reject Application";
    }

    document.getElementById('detailsModal').classList.remove('hidden');
}

window.closeModal = function() {
    document.getElementById('detailsModal').classList.add('hidden');
}

// --- 5. ACTIONS ---
document.getElementById('btnApprove').onclick = async () => {
    if(!confirm("Approve this shop? It will appear on the user map immediately.")) return;
    updateStatus('approved');
};

document.getElementById('btnReject').onclick = async () => {
    if(!confirm("Reject this application?")) return;
    updateStatus('rejected');
};

async function updateStatus(newStatus) {
    try {
        await updateDoc(doc(db, "shops", currentShopId), { status: newStatus });
        closeModal();
        loadDashboardData();
        alert("Shop status updated successfully.");
    } catch (err) {
        alert("Error: " + err.message);
    }
}

// --- 6. FILTERS ---
window.filterShops = function(status) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if(status === 'all') renderTable(allShops);
    else renderTable(allShops.filter(s => s.status === status));
}

window.logoutAdmin = function() {
    signOut(auth).then(() => window.location.href = "index.html");
}