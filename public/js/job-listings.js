// Sample data for posts
const posts = [
    {
        _id: 1,
        jobTitle: "Job 1",
        jobLocation: "Location 1",
        category: "Architecture",
        jobDeadline: "2023-11-01",
        jobPriceRange: "$1000 - $2000",
    },
    {
        _id: 2,
        jobTitle: "Job 2",
        jobLocation: "Location 2",
        category: "Construction",
        jobDeadline: "2023-11-15",
        jobPriceRange: "$800 - $1500",
    },
    {
        _id: 3,
        jobTitle: "Job 3",
        jobLocation: "Location 3",
        category: "Interior Design",
        jobDeadline: "2023-11-10",
        jobPriceRange: "$1200 - $2500",
    },
    {
        _id: 4,
        jobTitle: "Job 4",
        jobLocation: "Location 1",
        category: "Architecture",
        jobDeadline: "2023-11-01",
        jobPriceRange: "$1000 - $2000",
    },
    {
        _id: 5,
        jobTitle: "Job 5",
        jobLocation: "Location 2",
        category: "Floor Plan",
        jobDeadline: "2023-11-15",
        jobPriceRange: "$800 - $1500",
    },
    {
        _id: 6,
        jobTitle: "Job 6",
        jobLocation: "Location 3",
        category: "Architectural Design And Drafting",
        jobDeadline: "2023-11-10",
        jobPriceRange: "$1200 - $2500",
    },
    {
        _id: 7,
        jobTitle: "Job 7",
        jobLocation: "Location 1",
        category: "Structural Engineering",
        jobDeadline: "2023-11-01",
        jobPriceRange: "$1000 - $2000",
    },
    {
        _id: 8,
        jobTitle: "Job 8",
        jobLocation: "Location 2",
        category: "Electrical Installation",
        jobDeadline: "2023-11-15",
        jobPriceRange: "$800 - $1500",
    },
    {
        _id: 9,
        jobTitle: "Job 9",
        jobLocation: "Location 3",
        category: "Plumbing and sanitary works",
        jobDeadline: "2023-11-10",
        jobPriceRange: "$1200 - $2500",
    },
];
const filterSelect = document.getElementById("filter");
const sortSelect = document.getElementById("sort");
const postContainer = document.getElementById("post-container");
const priceRangeInput = document.getElementById("priceRange");
const priceRangeValue = document.getElementById("priceRangeValue");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");
let currentSortOrder = "asc"; // Default sorting order

// Function to update the option labels with post counts
function updateOptionLabels() {
    const categoryCounts = {};

    // Count posts in each category
    posts.forEach(post => {
        categoryCounts[post.category] = (categoryCounts[post.category] || 0) + 1;
    });

    // Update option labels with post counts
    const options = filterSelect.getElementsByTagName("option");

    for (let i = 1; i < options.length; i++) {
        const category = options[i].value;
        const count = categoryCounts[category] || 0;
        options[i].textContent = `${options[i].textContent.split(' (')[0]} (${count})`;
    }
}

// Function to sort posts by date
function sortPosts(posts, sortOrder) {
    if (sortOrder === "asc") {
        return posts.slice().sort((a, b) => a.jobDeadline.localeCompare(b.jobDeadline));
    } else if (sortOrder === "desc") {
        return posts.slice().sort((a, b) => b.jobDeadline.localeCompare(a.jobDeadline));
    }
}

function filterSortAndPriceRange(category, sortOrder, minPrice, maxPrice) {
    const filteredPosts = category === "all" ? posts : posts.filter(post => post.category === category);
    const sortedPosts = sortPosts(filteredPosts, sortOrder);
    const filteredAndSortedPosts = sortedPosts.filter(post => {
        const price = parseInt(post.jobPriceRange.split(" - ")[1].replace(/\$/g, ""));
        return price >= minPrice && price <= maxPrice;
    });

    postContainer.innerHTML = ""; // Clear previous posts

    filteredAndSortedPosts.forEach(post => {
        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div class="title-card">
                <strong>Title:</strong> ${post.jobTitle}
            </div>
            <div class="job-details">
                <img src="placeholder_819814.png" alt="" />
                <strong>Location:</strong> ${post.jobLocation}
            </div>
            <div class="job-details">
                <img src="options_718970.png" alt="" />
                <strong>Category:</strong> ${post.category}
            </div>
            <div class="job-details">
                <img src="campaign_10139087.png" alt="" />
                <strong>Deadline:</strong> ${post.jobDeadline}
            </div>
            <div class="job-details">
                <img src="coin_7891996.png" alt="" />
                <strong>Price Range:</strong> ${post.jobPriceRange}
            </div>
            <button onclick="viewJobDetails(${post._id})">View Details</button>
        `;

        postContainer.appendChild(card);
    });
}

// Initial call to display all posts and update option labels
filterSortAndPriceRange("all", currentSortOrder, parseInt(minPriceInput.value), parseInt(maxPriceInput.value));
updateOptionLabels();

// Add event listeners to update the displayed posts, sort order, and price range
filterSelect.addEventListener("change", function() {
    const selectedCategory = filterSelect.value;
    filterSortAndPriceRange(selectedCategory, currentSortOrder, parseInt(minPriceInput.value), parseInt(maxPriceInput.value));
});

sortSelect.addEventListener("change", function() {
    currentSortOrder = sortSelect.value;
    filterSortAndPriceRange(filterSelect.value, currentSortOrder, parseInt(minPriceInput.value), parseInt(maxPriceInput.value));
});

minPriceInput.addEventListener("input", function() {
    const minPrice = parseInt(minPriceInput.value);
    filterSortAndPriceRange(filterSelect.value, currentSortOrder, minPrice, parseInt(maxPriceInput.value));
});

maxPriceInput.addEventListener("input", function() {
    const maxPrice = parseInt(maxPriceInput.value);
    filterSortAndPriceRange(filterSelect.value, currentSortOrder, parseInt(minPriceInput.value), maxPrice);
});

// Function to view job details (You can implement this as needed)
function viewJobDetails(jobId) {
    // Implement code to view job details based on the jobId.
    // You can use the jobId to retrieve specific job details from your data.
    alert("View job details for Job ID: " + jobId);
}