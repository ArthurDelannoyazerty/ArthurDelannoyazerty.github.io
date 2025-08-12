document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const copyButton = document.getElementById('copyButton');
    const outputElement = document.getElementById('output');
    const loadingStatusElement = document.getElementById('loadingStatus');

    let eventSource;
    let llmPromptParts = [];

    scanButton.addEventListener('click', async () => {
        if (eventSource) {
            eventSource.close();
        }

        llmPromptParts = ["Based on the following Gist files, find the most relevant function/gist to solve my problem.\n\n--- GIST CATALOG ---"];
        outputElement.textContent = '';
        loadingStatusElement.textContent = 'Initializing connection...';
        scanButton.disabled = true;
        
        let totalGists = 0;
        const filterType = document.querySelector('input[name="fileTypeFilter"]:checked').value;
        
        eventSource = new EventSource(`/api/scan_gists?filter=${filterType}`);

        eventSource.addEventListener('total', (event) => {
            const data = JSON.parse(event.data);
            totalGists = data.count;
            loadingStatusElement.textContent = `Found ${totalGists} Gists. Starting scan...`;
        });

        // --- THIS IS THE MODIFIED SECTION ---
        eventSource.addEventListener('progress', (event) => {
            const data = JSON.parse(event.data);
            const gist = data.gist;

            loadingStatusElement.textContent = `Scanning... (${data.index}/${totalGists})`;

            // Get the data from the gist object
            const gistTitle = gist.description || 'No Title';
            const gistUrl = gist.html_url; // <-- Get the public URL here
            const fileContents = Object.values(gist.files).map(file => 
                `---\nFileName: ${file.filename}\nContent:\n${file.content}\n---`
            ).join('\n');
            
            // Construct the block, now including the Gist URL
            const gistBlock = `\n\nGist Title: ${gistTitle}\nDescription: ${gist.description || 'N/A'}\nURL: ${gistUrl}\nFiles:\n${fileContents}`;
            
            llmPromptParts.push(gistBlock);
            outputElement.textContent = llmPromptParts.join('');
        });
        // --- END OF MODIFIED SECTION ---

        eventSource.addEventListener('done', (event) => {
            const data = JSON.parse(event.data);
            loadingStatusElement.textContent = `${data.message} Processed ${data.totalProcessed} gists.`;
            eventSource.close();
            scanButton.disabled = false;
        });

        eventSource.onerror = (err) => {
            loadingStatusElement.textContent = 'An error occurred with the connection.';
            console.error('EventSource failed:', err);
            eventSource.close();
            scanButton.disabled = false;
        };
    });
    
    copyButton.addEventListener('click', () => {
        const textToCopy = llmPromptParts.join('');
        if (textToCopy && llmPromptParts.length > 1) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyButton.textContent = 'Copied!';
                setTimeout(() => { copyButton.textContent = 'Copy Prompt'; }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        }
    });
});