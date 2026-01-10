// --- DATA CONFIGURATION ---
// "Admins" (Developers) can edit the content here directly.
const contentData = {
    // Technical Details
    frontend: {
        title: "Frontend Architecture",
        description: `
            <p><strong>Technologies Used:</strong> HTML5, CSS3, Vanilla JavaScript (ES6+).</p>
            <p><strong>Design Philosophy:</strong> We utilized a mobile-first approach to ensure the application is accessible on all devices. The UI relies on CSS Grid and Flexbox for layout management, ensuring that the complex data (like hospital lists) is presented cleanly.</p>
            <p><strong>Interactivity:</strong> JavaScript DOM manipulation is used to handle real-time search filtering for blood banks and shops without needing to reload the page constantly. We avoided heavy frameworks to keep the site lightweight and fast for users in areas with poor internet connectivity.</p>
        `,
        links: [] // No links needed for tech boxes usually
    },
    backend: {
        title: "Backend Infrastructure",
        description: `
            <p><strong>Core Engine:</strong> Google Firebase.</p>
            <p><strong>Database:</strong> We use Cloud Firestore (NoSQL) to store user profiles, event registrations, and donation requests. This allows for flexible data structures that can evolve as the project grows.</p>
            <p><strong>Authentication:</strong> Firebase Auth handles secure sign-ins (Email/Password), ensuring user data remains private.</p>
            <p><strong>Hosting:</strong> The application is deployed via Firebase Hosting, providing global CDN support and fast load times.</p>
        `,
        links: []
    },

    // Team Profiles
    soumik: {
        title: "Soumik Bhuniya",
        description: `
            <p><strong>Role:</strong> Lead Developer - Donation Systems</p>
            <p>Soumik designed the core logic for the blood and organ donation brokerage. He implemented the credit algorithm that rewards donors and managed the database relationships between donors and organizations.</p>
        `,
        links: [
            { text: "GitHub", url: "https://github.com/soumik-example" },
            { text: "LinkedIn", url: "https://linkedin.com/in/soumik-example" }
        ]
    },
    ayush: {
        title: "Ayush Nandi",
        description: `
            <p><strong>Role:</strong> Lead Developer - Pharmacy Locator</p>
            <p>Ayush integrated the mapping logic (using OpenStreetMap) to locate nearby pharmacies. He focused on the search algorithms that allow users to find specific medicines in shops near them.</p>
        `,
        links: [
            { text: "GitHub", url: "https://github.com/ayush-nandi" },
            { text: "LinkedIn", url: "https://linkedin.com/in/ayushnandi" }
        ]
    },
    avilekh: {
        title: "Avilekh Roy",
        description: `
            <p><strong>Role:</strong> Lead Developer - Hospital Info</p>
            <p>Avilekh built the hospital directory. His work involved creating a robust search filter that allows users to find hospitals based on facilities (e.g., ICU availability, Emergency Wards).</p>
        `,
        links: [
            { text: "GitHub", url: "https://github.com/avilekh-example" },
            { text: "LinkedIn", url: "#" }
        ]
    },
    prashun: {
        title: "Prashun Kumar Roy",
        description: `
            <p><strong>Role:</strong> Lead Developer - Event Management</p>
            <p>Prashun handled the 'Events' section where users can register for health camps. He built the form validation systems and the backend triggers that store participant data.</p>
        `,
        links: [
            { text: "GitHub", url: "https://github.com/prashun-example" },
            { text: "Instagram", url: "#" }
        ]
    }
};

// --- LOGIC ---

const modal = document.getElementById("infoModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalLinks = document.getElementById("modalLinks");

// Function called when a box or card is clicked
function openModal(key) {
    const data = contentData[key];

    if (!data) return; // Safety check

    // 1. Set Title
    modalTitle.textContent = data.title;

    // 2. Set Description (innerHTML allows HTML tags like <p> inside)
    modalBody.innerHTML = data.description;

    // 3. Generate Links (if any)
    modalLinks.innerHTML = ""; // Clear previous links
    if (data.links && data.links.length > 0) {
        data.links.forEach(link => {
            const a = document.createElement("a");
            a.href = link.url;
            a.textContent = link.text;
            a.target = "_blank"; // Open in new tab
            a.className = "profile-link";
            modalLinks.appendChild(a);
        });
    }

    // 4. Show Modal
    modal.style.display = "block";
}

// Function to close modal
function closeModal() {
    modal.style.display = "none";
}

// Close modal if user clicks outside the content box
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}
