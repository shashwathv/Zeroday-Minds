document.addEventListener('DOMContentLoaded', function() {
  let isVisible = false;
  let capturedText = "";

  // Get DOM elements
  const analyzeBtn = document.getElementById('analyzeBtn');
  const toggleBtn = document.getElementById('toggleBtn');
  const contentDiv = document.getElementById('content');
  const resultDiv = document.getElementById('result');

  // Capture text from current tab
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: getPageText
    }, results => {
      if (!results || !results[0]?.result) {
        contentDiv.textContent = "Failed to capture email content.";
        return;
      }
      capturedText = results[0].result;
      contentDiv.textContent = capturedText.slice(0, 10000);
    });
  });

  // Analyze Email Button
  analyzeBtn.addEventListener('click', async () => {
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="loading-spinner"></span> Analyzing';
    
    const emailText = capturedText || contentDiv.textContent;
    const analysis = await analyzeWithGemini(emailText);
    const formattedResult = formatResult(analysis);
    
    resultDiv.innerHTML = formattedResult;
    resultDiv.className = `result-container ${analysis.verdict.toLowerCase()}`;
    resultDiv.classList.remove('hidden');
    
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<span class="button-icon">🔍</span> Analyze Email';
    
    // Add toggle for technical details
    document.querySelector('.details-toggle')?.addEventListener('click', function() {
      const detailsDiv = this.nextElementSibling;
      detailsDiv.classList.toggle('hidden');
      this.textContent = detailsDiv.classList.contains('hidden') ? 
        '▼ Show technical details' : '▲ Hide details';
    });
  });

  // Toggle Content Button
  toggleBtn.addEventListener('click', () => {
    isVisible = !isVisible;
    contentDiv.classList.toggle('hidden', !isVisible);
    toggleBtn.innerHTML = isVisible 
      ? '<span class="button-icon">📄</span> Hide Email Content' 
      : '<span class="button-icon">📄</span> Show Email Content';
  });

  // Helper Functions
  function getPageText() {
    return document.body.innerText;
  }

  async function analyzeWithGemini(emailText) {
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=AIzaSyD5ogCJK8sC14YD22B7r-nQkG1EepuoFQw",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Analyze this email for phishing risk. Respond with ONLY a JSON object in this exact format:
  {
    "verdict": "PHISHING|SAFE|WARNING",
    "confidence": 1-100,
    "summary": "concise explanation",
    "details": {
      "sender": "analysis",
      "content": "analysis", 
      "links": "analysis",
      "context": "analysis"
    }
  }
  
  Email content: ${emailText.substring(0, 15000)}`
              }]
            }]
          })
        }
      );
  
      const data = await response.json();
      console.log("Raw API response:", data); // For debugging
      
      // Handle different response formats
      const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 
                          data?.predictions?.[0]?.content || 
                          JSON.stringify(data);
      
      return parseAnalysis(responseText);
    } catch (error) {
      console.error("API Error:", error);
      return {
        verdict: "WARNING",
        confidence: 0,
        summary: "API request failed",
        details: {
          sender: "Error",
          content: error.message,
          links: "N/A",
          context: "N/A"
        }
      };
    }
  }
  
  function parseAnalysis(response) {
    // First try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : response;
    
    try {
      const result = JSON.parse(jsonString);
      
      // Validate the required fields
      if (!result.verdict || !result.summary) {
        throw new Error("Invalid response format");
      }
      
      return {
        verdict: ["PHISHING", "SAFE", "WARNING"].includes(result.verdict) 
          ? result.verdict 
          : "WARNING",
        confidence: Math.min(100, Math.max(0, Number(result.confidence) || 50)),
        summary: result.summary || "No analysis summary provided",
        details: {
          sender: result.details?.sender || "Not analyzed",
          content: result.details?.content || "Not analyzed",
          links: result.details?.links || "Not analyzed",
          context: result.details?.context || "Not analyzed"
        }
      };
    } catch (e) {
      console.error("Parsing failed:", e);
      return {
        verdict: "WARNING",
        confidence: 50,
        summary: "Couldn't parse analysis response",
        details: {
          sender: "Error",
          content: "Invalid API response format",
          links: "N/A",
          context: "N/A"
        }
      };
    }
  }

  function formatResult(result) {
    const confidenceColor = result.confidence > 75 ? 
      (result.verdict === "SAFE" ? "#38a169" : "#e53e3e") : 
      "#dd6b20";

    return `
      <div class="analysis-card ${result.verdict.toLowerCase()}">
        <div class="verdict-line">
          <span class="verdict-icon">${getIcon(result.verdict)}</span>
          <span class="verdict-text">${result.verdict}</span>
          <span class="confidence" style="color: ${confidenceColor}">
            ${result.confidence}% confidence
          </span>
        </div>
        <div class="summary">${result.summary}</div>
        <div class="details-toggle">▼ Show technical details</div>
        <div class="technical-details hidden">
          ${formatDetails(result.details)}
        </div>
      </div>
    `;
  }

  function getIcon(verdict) {
    return {
      'PHISHING': '🚨',
      'SAFE': '✅',
      'WARNING': '⚠️'
    }[verdict] || '❓';
  }

  function formatDetails(details) {
    return `
      <ul class="detail-list">
        <li><strong>Sender:</strong> ${details.sender || "Not analyzed"}</li>
        <li><strong>Content:</strong> ${details.content || "Not analyzed"}</li>
        <li><strong>Links:</strong> ${details.links || "Not analyzed"}</li>
        <li><strong>Context:</strong> ${details.context || "Not analyzed"}</li>
      </ul>
    `;
  }

  function formatError() {
    return `
      <div class="analysis-card warning">
        <div class="verdict-line">
          <span class="verdict-icon">⚠️</span>
          <span class="verdict-text">ANALYSIS FAILED</span>
        </div>
        <div class="summary">Could not complete analysis. Please try again.</div>
      </div>
    `;
  }
});