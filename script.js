document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const copyButton = document.getElementById('copyButton');
    const outputElement = document.getElementById('output');
    const loadingStatusElement = document.getElementById('loadingStatus');

    let eventSource;
    let llmPromptParts = [];

    function fallbackCopyTextToClipboard(text, button) {
        // 1. Create a temporary textarea element
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // 2. Make the textarea invisible and add it to the page
        textArea.style.position = "fixed";
        textArea.style.top = 0;
        textArea.style.left = 0;
        textArea.style.width = "2em";
        textArea.style.height = "2em";
        textArea.style.padding = 0;
        textArea.style.border = "none";
        textArea.style.outline = "none";
        textArea.style.boxShadow = "none";
        textArea.style.background = "transparent";
        document.body.appendChild(textArea);
        textArea.focus();
        
        // 3. Select the text and execute the copy command
        textArea.select();
        try {
            document.execCommand('copy');
            // If successful, update the button text
            button.textContent = 'Copied!';
            setTimeout(() => { button.textContent = 'Copy Prompt'; }, 2000);
        } catch (err) {
            console.error('Fallback copy method failed', err);
        }
        
        // 4. Clean up by removing the textarea
        document.body.removeChild(textArea);
    }

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
        if (!textToCopy || llmPromptParts.length <= 1) return;

        // Try the modern `navigator.clipboard` API first
        if (!navigator.clipboard) {
            fallbackCopyTextToClipboard(textToCopy, copyButton);
            return;
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            // If successful, update the button text
            copyButton.textContent = 'Copied!';
            setTimeout(() => { copyButton.textContent = 'Copy Prompt'; }, 2000);
        }).catch((err) => {
            // If it fails (as it does in Firefox), log the error and use the fallback
            console.warn('Modern clipboard API failed. Using fallback. Error:', err);
            fallbackCopyTextToClipboard(textToCopy, copyButton);
        });
    });

    downloadButton.addEventListener('click', () => {
        const textToDownload = llmPromptParts.join('');
        
        // Ensure there is content to download
        if (!textToDownload || llmPromptParts.length <= 1) {
            alert("There is no prompt to download. Please run a scan first.");
            return;
        }

        // 1. Create a Blob (a file-like object) from the text
        const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });

        // 2. Create a temporary URL for the Blob
        const url = URL.createObjectURL(blob);

        // 3. Create a temporary anchor (`<a>`) element to trigger the download
        const link = document.createElement('a');
        link.href = url;
        link.download = 'gist_prompt.txt'; // The default filename for the download

        // 4. Programmatically click the link to start the download, then clean up
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Free up browser memory
    });
});