// content.js
function getEmailContent() {
    // Example for Gmail (simplified)
    const emailBody = document.querySelector(".a3s"); // Gmail's email body container
    return emailBody ? emailBody.innerText : "Unable to find email content.";
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getEmailContent") {
      sendResponse({ text: getEmailContent() });
    }
  });
  