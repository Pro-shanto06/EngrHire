function acceptBid(bidId, jobId) {
  console.log("Accept button clicked.");
  console.log("Bid ID: " + bidId);
  console.log("Job ID: " + jobId);
  $.ajax({
    type: "POST",
    url: "/accept-bid",
    data: { bidId: bidId, jobId: jobId },
    success: function (response) {
      console.log("Response from server:", response);
      console.log("AJAX request successful.");
      alert("Bid accepted. Engineer will be notified.");
      removeBidCard("pending-bids-list", bidId);


      addBidToSection("accepted-bids-list", response);
      location.reload(true);
    },
    error: function (error) {
      console.log("AJAX request failed.");
      alert("Error accepting the bid.");
    },
  });
}

function rejectBid(bidId, jobId) {
  console.log("Reject button clicked.");
  console.log("Bid ID: " + bidId);
  console.log("Job ID: " + jobId);

  $.ajax({
    type: "POST",
    url: "/reject-bid",
    data: { bidId: bidId, jobId: jobId },
    success: function (response) {
      console.log("Response from server:", response);
      console.log("AJAX request successful.");
      alert("Bid rejected. Engineer will be notified.");

      removeBidCard("pending-bids-list", bidId);
      addBidToSection("rejected-bids-list", response);
      location.reload(true);
    },
    error: function (error) {
      console.log("AJAX request failed.");
      console.error(error); 
      alert("Error rejecting the bid.");
    },
  });
}


function removeBidCard(sectionId, bidId) {
  const bidCard = $(`#${sectionId} [data-bidid="${bidId}"]`);
  bidCard.closest("li").remove();
}

function addBidToSection(sectionId, response) {
  const sectionContainer = $(`#${sectionId}`);
   const options = { timeZone: 'Asia/Dhaka', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
  const bidCard = `

       
  <div class="mt-2 mb-2">
  <div class="d-flex justify-content-center row">
      <div class="col-md-10">
          <div class="row p-2 bg-white border rounded bid-card" style="box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
              <div class="col-md-8">
                  <h4 class="mb-2">${response.jobTitle}</h4>
                  <h6 class="text-muted mb-3">${new Date(response.jobDeadline).toLocaleString('en-US', options)}</h6>
                  <p class="text-justify text-truncate para mb-3">${response.bidDetails}<br><br></p>
              </div>
              <div class="col-md-4 border-left">
                  <div class="d-flex flex-column align-items-center">
                      <h4 class="mb-3">${response.bidAmount}</h4>
                      <a class="btn btn-primary btn-sm" href="/work/${response.workId}" style="background-color: #3498db;">View Work</a>
                  </div>
              </div>
          </div>
      </div>
  </div>
</div>

 

    
  `;
  sectionContainer.append(bidCard);
}



function fetchAcceptedBids() {
  $.ajax({
    type: "GET",
    url: "/api/accepted-bids",
    success: function (data) {
      console.log("Successfully fetched accepted bids.");
      updateAcceptedBids(data);
    },
    error: function (error) {
      console.log("Error fetching accepted bids: " + JSON.stringify(error));
    },
  });
}

function fetchRejectedBids() {
  $.ajax({
    type: "GET",
    url: "/api/rejected-bids",
    success: function (data) {
      console.log("Successfully fetched rejected bids.");
      updateRejectedBids(data);
    },
    error: function (error) {
      console.log("Error fetching rejected bids: " + JSON.stringify(error));
    },
  });
}

function fetchPendingBids() {
  $.ajax({
    type: "GET",
    url: "/api/pending-bids",
    success: function (data) {
      console.log("Successfully fetched pending bids.");
      updatePendingBids(data);
    },
    error: function (error) {
      console.log("Error fetching pending bids: " + JSON.stringify(error));
    },
  });
}

function updateAcceptedBids(acceptedBids) {
  const acceptedBidsContainer = $("#accepted-bids-list");
  acceptedBidsContainer.empty();

  acceptedBids.forEach(function (bid) {
    const options = { timeZone: 'Asia/Dhaka', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
    const bidCard = `
  
    <div class="mb-4 mt-4">
    <div class="d-flex justify-content-center row">
      <div class="col-md-8">
        <div class="row p-3 bg-white border rounded bid-card" style="box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
          <div class="col-md-8">
            <h4 class="mb-2">${bid.jobTitle}</h4>
            <h6 class="text-muted mb-3">${new Date(bid.jobDeadline).toLocaleString('en-US', options)}</h6>
            <p class="text-justify text-truncate para mb-3">${bid.bidDetails}<br><br></p>
          </div>
          <div class="col-md-4 border-left">
            <div class="d-flex flex-column align-items-center">
              <h4 class="mb-3">${bid.bidAmount}</h4>
              <a class="btn btn-primary btn-sm" href="/work/${bid.workId}" style="background-color: #3498db;">View Work</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  

    `;

    acceptedBidsContainer.append(bidCard);
  });
}

function updateRejectedBids(rejectedBids) {
  const rejectedBidsContainer = $("#rejected-bids-list");
  rejectedBidsContainer.empty();

  rejectedBids.forEach(function (bid) {
    const options = { timeZone: 'Asia/Dhaka', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
    const bidCard = `

   <div class="container mt-2 mb-2">
      <div class="d-flex justify-content-center row">
        <div class="col-md-10">
          <div class="row p-2 bg-white border rounded bid-card">
            <div class="col-md-6 mt-1">
              <h4>${bid.jobTitle}</h4>
              <h5>${new Date(bid.jobDeadline).toLocaleString('en-US', options)}</h5>
              <div class="d-flex flex-row">
              
                <span>${bid.engineerFullName}</span>
              </div>
              <p class="text-justify text-truncate para mb-0">${bid.bidDetails}<br><br></p>
            </div>
            <div class="align-items-center align-content-center col-md-3 border-left mt-1">
              <div class="d-flex flex-row align-items-center">
                <h4 class="mr-1">${bid.bidAmount}</h4>
              </div>
              
              <a class="btn btn-primary btn-sm" href="/work/${bid.workId}" style="background-color: #3498db;">View Work</a>
            </div>
          </div>
        </div>
      </div>
    </div>
   
    `;

    rejectedBidsContainer.append(bidCard);
  });
}

function updatePendingBids(pendingBids) {
  const pendingBidsContainer = $("#pending-bids-list");
  pendingBidsContainer.empty();

  pendingBids.forEach(function (bid) {

    const options = { timeZone: 'Asia/Dhaka', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
    
    const bidCard = `
    
       
    <div class="mt-2 mb-2">
    <div class="d-flex justify-content-center row">
      <div class="col-md-10">
        <div class="row p-2 bg-white border rounded bid-card">
          <div class="col-md-6 mt-1">
            <h4>${bid.jobTitle}</h4>
            <h5>${new Date(bid.jobDeadline).toLocaleString('en-US', options)}</h5>
            <div class="d-flex flex-row">
              <span>${bid.engineerFullName}</span>
            </div>
            <p class="text-justify text-truncate para mb-0">${bid.bidDetails}<br><br></p>
          </div>
          <div class="align-items-center align-content-center col-md-3 border-left mt-1">
            <div class="d-flex flex-row align-items-center">
              <h4 class="mr-1">${bid.bidAmount}</h4>
            </div>
            <div class="d-flex flex-column mt-4 bid-actions">
              <button class="btn accept-bid" style="background-color: #28a745; color: #fff; margin-bottom: 10px;" data-bidid="${bid._id}" data-jobid="${bid.job}" onclick="acceptBid('${bid._id}', '${bid.job}')">Accept</button>
              <button class="btn reject-bid" style="background-color: #dc3545; color: #fff; " data-bidid="${bid._id}" data-jobid="${bid.job}" onclick="rejectBid('${bid._id}', '${bid.job}')">Reject</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  
    `;

    pendingBidsContainer.append(bidCard);
  });
}

$(document).ready(() => {
  fetchAcceptedBids();
  fetchRejectedBids();
  fetchPendingBids();
});


