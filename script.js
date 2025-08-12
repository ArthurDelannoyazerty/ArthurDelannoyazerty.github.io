// This script now uses EventSource to listen for streamed server events

document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const copyButton = document.getElementById('copyButton');
    const outputElement = document.getElementById('output');
    const loadingStatusElement = document.getElementById('loadingStatus');

    let eventSource;

    scanButton.addEventListener('click', async () => {
        // Close any existing connection
        if (eventSource) {
            eventSource.close();
        }

        // Clear UI and disable button
        outputElement.textContent = '';
        loadingStatusElement.textContent = 'Initializing connection...';
        scanButton.disabled = true;
        
        let llmPromptParts = ["Based on the following Gist files I have created, find the most relevant function to solve my problem.\n\nProblem: [**DESCRIBE YOUR PROBLEM HERE**]\n\n--- GIST DATABASE ---"];
        let totalGists = 0;

        const filterType = document.querySelector('input[name="fileTypeFilter"]:checked').value;
        
        // 1. Create a new EventSource to connect to our streaming API
        eventSource = new EventSource(`/api/scan_gists?filter=${filterType}`);

        // 2. Listen for the 'total' event (our custom event)
        eventSource.addEventListener('total', (event) => {
            const data = JSON.parse(event.data);
            totalGists = data.count;
            loadingStatusElement.textContent = `Found ${totalGists} Gists. Starting scan...`;
        });

        // 3. Listen for the 'progress' event and update the UI in real-time
        eventSource.addEventListener('progress', (event) => {
            const data = JSON.parse(event.data);
            const gist = data.gist;

            // Update loading status
            loadingStatusElement.textContent = `Scanning... (${data.index}/${totalGists})`;

            // Build the prompt piece by piece
            const gistTitle = gist.description || 'No Title';
            const fileContents = Object.values(gist.files).map(file => 
                `---\nFileName: ${file.filename}\nContent:\n${file.content}\n---`
            ).join('\n');
            
            const gistBlock = `\n\nGist Title: ${gistTitle}\nDescription: ${gist.description || 'N/A'}\nFiles:\n${fileContents}`;
            llmPromptParts.push(gistBlock);
            
            // Update the text area in real-time so you can see the prompt being built
            outputElement.textContent = llmPromptParts.join('');
        });

        // 4. Listen for the 'done' event to know when to close
        eventSource.addEventListener('done', (event) => {
            const data = JSON.parse(event.data);
            loadingStatusElement.textContent = `${data.message} Processed ${data.totalProcessed} gists.`;
            eventSource.close();
            scanButton.disabled = false;
        });

        // 5. Handle any errors
        eventSource.onerror = (err) => {
            loadingStatusElement.textContent = 'An error occurred with the connection.';
            console.error('EventSource failed:', err);
            eventSource.close();
            scanButton.disabled = false;
        };
    });
    
    // Copy button logic remains the same
    copyButton.addEventListener('click', () => { /* ... */ });
});