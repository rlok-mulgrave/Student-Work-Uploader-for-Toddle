// ================= UTILITIES =================
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Robust element waiter (Helper for the return step)
function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            let element = null;
            if (selector.startsWith('//')) {
                element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            } else {
                element = document.querySelector(selector);
            }
            if (element) resolve(element);
            else if (Date.now() - startTime > timeout) reject(new Error(`Timeout waiting for ${selector}`));
            else requestAnimationFrame(check);
        };
        check();
    });
}

// ================= GLOBAL BROWSER FIX (Safety Net) =================
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  window.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
  }, false);
  document.body.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
  }, false);
});

// Flag to track if the user clicked "Run Now" manually or used Shortcut
let isManualRun = false;
// Flag to track if drag and drop is currently working
let isDragDropRun = false;


// ================= PART 1: MANUAL SHORTCUT SEQUENCE =================
async function runShortcutSequence() {
  console.log("--- ⌨️ Shortcut Sequence Starting ---");
  
  const plusButton = document.querySelector('[data-test-id="mediaManager-addResponse-button"]') 
                  || document.querySelector('[aria-label="Add"]');

  if (!plusButton) {
    console.log("Waiting for (+) button...");
    return;
  }

  // Prevent double-clicking via automated flag
  if (plusButton.getAttribute('data-auto-processed') === 'true') {
     if (!isManualRun) return; 
  }
  plusButton.setAttribute('data-auto-processed', 'true');

  // STEP 1: Click (+)
  plusButton.click();
  console.log("Step 1: Clicked (+) Button");

  await sleep(600); 

  // STEP 2: Click File
  const fileButton = document.evaluate("//*[contains(text(), 'File')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  if (fileButton) {
    fileButton.click();
    console.log("Step 2: Clicked 'File'");
  } else {
    console.log("Warning: 'File' step skipped");
  }

  await sleep(600); 

  // STEP 3: Click Device
  const deviceButton = document.getElementById("dropdown-item-upload_from_device");
  if (deviceButton) {
    deviceButton.click();
    console.log("Step 3: Clicked 'Device' - Waiting for user to pick file...");
    // The "Watchtower" (Observer) will handle the "Add to work" click once the file is picked.
  } else {
    console.log("Error: 'Device' button not found.");
  }
}

// ================= PART 2: DRAG & DROP LOGIC =================
function forceInjectFile(inputElement, files) {
  const dataTransfer = new DataTransfer();
  for (const file of files) {
    dataTransfer.items.add(file);
  }
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files');
  descriptor.set.call(inputElement, dataTransfer.files);
  inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  inputElement.dispatchEvent(new Event('input', { bubbles: true }));
}

async function handleDroppedFiles(files, targetElement) {
  if (isDragDropRun || isManualRun || files.length === 0) return;
  isDragDropRun = true;
  console.log(`--- 🤖 Drag & Drop Automation Starting ---`);

  try {
    // 0. Select Student
    const studentClickable = targetElement.querySelector('[class*="studentNameContainer"]') || targetElement;
    studentClickable.click();
    if(targetElement.parentElement) targetElement.parentElement.click();
    await sleep(800); 

    // 1. Click (+)
    const plusButton = document.querySelector('[data-test-id="mediaManager-addResponse-button"]') || document.querySelector('[aria-label="Add"]');
    if (plusButton) plusButton.click();
    await sleep(700); 

    // 2. Click "File"
    const fileButton = document.evaluate("//*[contains(text(), 'File')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (fileButton) fileButton.click();
    await sleep(800); 

    // 3. Inject File
    const fileInputs = document.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) {
      fileInputs.forEach(input => forceInjectFile(input, files));
    } else {
      isDragDropRun = false; return;
    }

    // 4. Wait for Add to Work and Complete
    const submitLoop = setInterval(async () => {
        const addToWorkBtn = document.querySelector('[data-test-id="journal-postcreation-publish-button"]');
        
        if (addToWorkBtn && !addToWorkBtn.disabled) {
            clearInterval(submitLoop);
            
            // ACTION: Submit
            addToWorkBtn.click();
            console.log("DragDrop: Uploaded & Submitted.");
            
            // 5. Return to List (EXCLUSIVE TO DRAG & DROP)
            try {
                const backButton = await waitForElement('[data-testid="allSubmissions-leftPane-allsubmissions"]', 20000); 
                await sleep(500);
                backButton.click();
                console.log("DragDrop: Returned to list.");
            } catch (e) {
                console.warn("DragDrop: Could not find return button.");
            }
            
            isDragDropRun = false;
        }
    }, 100);
    
    // Safety timeout for drag drop sequence
    setTimeout(() => { if(isDragDropRun) isDragDropRun = false; }, 30000);

  } catch (error) {
    isDragDropRun = false;
  }
}

function enableDragAndDrop() {
    const checkboxes = document.querySelectorAll('[data-test-id="allSubmissions-studentName-checkbox"]');
    if (checkboxes.length === 0) return;

    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('div[class*="gridItem"]') || checkbox.closest('div[class*="studentContainer"]')?.parentElement;
        if (!row || row.getAttribute('data-dnd-attached') === 'true') return;
        
        row.setAttribute('data-dnd-attached', 'true');

        row.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            row.style.backgroundColor = 'rgba(0, 131, 146, 0.15)'; 
            row.style.outline = '2px dashed #008392';
        });
        row.addEventListener('dragleave', (e) => {
            row.style.backgroundColor = '';
            row.style.outline = '';
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            row.style.backgroundColor = '';
            row.style.outline = '';
            const files = e.dataTransfer.files;
            if (files && files.length > 0) handleDroppedFiles(files, row);
        });
    });
}

// ================= THE WATCHTOWER (Observer) =================
// 1. Watches for Drag & Drop Targets
// 2. Watches for "Add to work" button (ONLY for Manual Shortcut)
function startObserver() {
  const observer = new MutationObserver((mutations) => {
    
    // A. Enable Drag and Drop whenever DOM changes
    enableDragAndDrop();

    // B. Manual Shortcut Logic Listener
    if (isManualRun) {
        const addToWorkBtn = document.querySelector('[data-test-id="journal-postcreation-publish-button"]');
        
        // If "Add to work" is found, enabled, and we haven't clicked it yet
        if (addToWorkBtn && !addToWorkBtn.disabled && !addToWorkBtn.hasAttribute('data-manual-processed')) {
            
            console.log("🚀 Manual Watchtower: File selected by user. Clicking 'Add to work'...");
            addToWorkBtn.setAttribute('data-manual-processed', 'true');
            
            // Step 4: Click Add to Work
            addToWorkBtn.click();

            // DO NOT GO BACK TO LIST
            console.log("✅ Manual Run Complete. Staying on page.");
            isManualRun = false; 
        }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ================= LISTENERS =================
if (chrome.runtime?.id) {
    startObserver();

    // Keyboard Shortcut (U)
    document.addEventListener('keydown', (event) => {
        if (event.key === "u" || event.key === "U") {
            const active = document.activeElement;
            const isInput = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable;
            if (isInput) return;

            console.log("⌨️ Shortcut (U) detected.");
            isManualRun = true;
            
            // Clean up old state if retrying
            const plusButton = document.querySelector('[data-test-id="mediaManager-addResponse-button"]');
            if (plusButton) plusButton.removeAttribute('data-auto-processed');
            
            const addToWorkBtn = document.querySelector('[data-test-id="journal-postcreation-publish-button"]');
            if (addToWorkBtn) addToWorkBtn.removeAttribute('data-manual-processed');
            
            runShortcutSequence();
        }
    });

    // Run from Popup Button
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === "run_sequence") {
        console.log("Manual 'Run Now' received.");
        isManualRun = true;
        
        const plusButton = document.querySelector('[data-test-id="mediaManager-addResponse-button"]');
        if(plusButton) plusButton.removeAttribute('data-auto-processed');
        
        const addToWorkBtn = document.querySelector('[data-test-id="journal-postcreation-publish-button"]');
        if (addToWorkBtn) addToWorkBtn.removeAttribute('data-manual-processed');
        
        runShortcutSequence();
      }
    });
}