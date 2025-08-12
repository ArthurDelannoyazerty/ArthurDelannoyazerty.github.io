// Final version with corrected copy functionality

document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const copyButton = document.getElementById('copyButton');
    const outputElement = document.getElementById('output');
    const loadingStatusElement = document.getElementById('loadingStatus');

    let eventSource;
    // --- FIX: ---
    // Move this array to a higher scope so both the scan and copy functions can access it.
    let llmPromptParts = [];

    scanButton.addEventListener('click', async () => {
        // Close any existing connection
        if (eventSource) {
            eventSource.close();
        }

        // Reset UI and the prompt data
        llmPromptParts = ["Based on the following Gist files I have created, find the most relevant function to solve my problem.\n\nProblem: [**DESCRIBE YOUR PROBLEM HERE**]\n\n--- GIST DATABASE ---"];
        outputElement.textContent = '';
        loadingStatusElement.textContent = 'Initializing connection...';
        scanButton.disabled = true;
        
        let totalGists = 0;
        const filterType = document.querySelector('input[name="fileTypeFilter"]:checked').value;
        
        // Create a new EventSource to connect to our streaming API
        eventSource = new EventSource(`/api/scan-gists?filter=${filterType}`);

        // Listen for the 'total' event
        eventSource.addEventListener('total', (event) => {
            const data = JSON.parse(event.data);
            totalGists = data.count;
            loadingStatusElement.textContent = `Found ${totalGists} Gists. Starting scan...`;
        });

        // Listen for the 'progress' event and update the UI in real-time
        eventSource.addEventListener('progress', (event) => {
            const data = JSON.parse(event.data);
            const gist = data.gist;

            loadingStatusElement.textContent = `Scanning... (${data.index}/${totalGists})`;

            const gistTitle = gist.description || 'No Title';
            const fileContents = Object.values(gist.files).map(file => 
                `---\nFileName: ${file.filename}\nContent:\n${file.content}\n---`
            ).join('\n');
            
            const gistBlock = `\n\nGist Title: ${gistTitle}\nDescription: ${gist.description || 'N/A'}\nFiles:\n${fileContents}`;
            llmPromptParts.push(gistBlock);
            
            // Update the text area in real-time
            outputElement.textContent = llmPromptParts.join('');
        });

        // Listen for the 'done' event to know when to close
        eventSource.addEventListener('done', (event) => {
            const data = JSON.parse(event.data);
            loadingStatusElement.textContent = `${data.message} Processed ${data.totalProcessed} gists.`;
            eventSource.close();
            scanButton.disabled = false;
        });

        // Handle any errors
        eventSource.onerror = (err) => {
            loadingStatusElement.textContent = 'An error occurred with the connection.';
            console.error('EventSource failed:', err);
            eventSource.close();
            scanButton.disabled = false;
        };
    });
    
    // This listener now correctly accesses the full prompt data.
    copyButton.addEventListener('click', () => {
        // Join the parts to get the full, final text.
        const textToCopy = llmPromptParts.join('');
        
        if (textToCopy && llmPromptParts.length > 1) { // Check if there's more than the initial message
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyButton.textContent = 'Copied!';
                setTimeout(() => { copyButton.textContent = 'Copy Prompt'; }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                // Fallback for user to copy manually
                outputElement.textContent = 'Failed to copy to clipboard. Please select all and copy manually.';
            });
        }
    });
});