// This is your new, simplified frontend script.

document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const copyButton = document.getElementById('copyButton');
    const outputElement = document.getElementById('output');
    const loadingStatusElement = document.getElementById('loadingStatus');

    scanButton.addEventListener('click', async () => {
        outputElement.textContent = 'Contacting server to start scan...';
        loadingStatusElement.textContent = 'Please wait...';
        scanButton.disabled = true; // Disable button to prevent multiple clicks

        // Get the selected filter from the radio buttons
        const filterType = document.querySelector('input[name="fileTypeFilter"]:checked').value;

        try {
            // 1. Call your own backend API, not GitHub's.
            // Pass the filter type as a query parameter.
            const response = await fetch(`/api/scan-gists?filter=${filterType}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server responded with status: ${response.status}`);
            }

            // 2. Get the processed data back from your API.
            const data = await response.json();

            // 3. Display the final result.
            outputElement.textContent = data.llmPrompt;
            loadingStatusElement.textContent = 'Scan complete!';

        } catch (error) {
            outputElement.textContent = `An error occurred: ${error.message}`;
            loadingStatusElement.textContent = 'Scan failed.';
        } finally {
            scanButton.disabled = false; // Re-enable the button
        }
    });

    // The copy button logic remains the same.
    copyButton.addEventListener('click', () => {
        const textToCopy = outputElement.textContent;
        if (textToCopy && textToCopy !== 'The generated prompt will appear here...') {
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyButton.textContent = 'Copied!';
                setTimeout(() => { copyButton.textContent = 'Copy Prompt'; }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        }
    });
});