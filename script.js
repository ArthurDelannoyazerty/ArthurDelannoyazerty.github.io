document.addEventListener('DOMContentLoaded', () => {
    const scanButton = document.getElementById('scanButton');
    const copyButton = document.getElementById('copyButton');
    const outputElement = document.getElementById('output');
    const loadingStatusElement = document.getElementById('loadingStatus');

    scanButton.addEventListener('click', async () => {
        outputElement.textContent = 'Preparing to scan...';
        loadingStatusElement.textContent = '';

        try {
            const repoOwner = 'ArthurDelannoyazerty';
            const repoName = 'my-gists';
            const filterType = document.querySelector('input[name="fileTypeFilter"]:checked').value;

            // 1. Get the README content
            const readmeUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/README.md`;
            const readmeResponse = await fetch(readmeUrl, {
                headers: { 'Accept': 'application/vnd.github.v3.raw' }
            });
            if (!readmeResponse.ok) throw new Error(`Failed to fetch README: ${readmeResponse.statusText}`);
            const readmeContent = await readmeResponse.text();

            // 2. Retrieve all Gist links
            const gistLinks = readmeContent.match(/https:\/\/gist\.github\.com\/[a-zA-Z0-9-]+\/[a-f0-9]+/g) || [];
            if (gistLinks.length === 0) {
                outputElement.textContent = 'No Gist links found in the README.md file.';
                return;
            }

            let allGistsContent = [];
            const totalGists = gistLinks.length;
            loadingStatusElement.textContent = `Found ${totalGists} Gists. Starting scan with '${filterType}' filter...`;
            outputElement.textContent = '';

            // 3. For every Gist link, get its details and filter if necessary
            for (let i = 0; i < totalGists; i++) {
                const link = gistLinks[i];
                loadingStatusElement.textContent = `Scanning... (${i + 1}/${totalGists})`;
                
                const gistId = link.split('/').pop();
                const gistApiUrl = `https://api.github.com/gists/${gistId}`;
                const gistResponse = await fetch(gistApiUrl);
                if (!gistResponse.ok) {
                    console.warn(`Could not fetch Gist with ID: ${gistId}`);
                    continue;
                }
                const gistData = await gistResponse.json();

                // Filtering logic starts here
                if (filterType === 'python') {
                    let hasPythonFile = false;
                    for (const filename in gistData.files) {
                        const file = gistData.files[filename];
                        // Check language property (more reliable) or file extension
                        if (file.language === 'Python' || filename.endsWith('.py')) {
                            hasPythonFile = true;
                            break; // Found a python file, no need to check further in this Gist
                        }
                    }
                    if (!hasPythonFile) {
                        continue; // Skip to the next Gist if no Python file is found
                    }
                }
                // Filtering logic ends here

                const gistTitle = gistData.description || 'No Title';
                let fileContents = [];

                for (const filename in gistData.files) {
                    const file = gistData.files[filename];
                    fileContents.push(`---\nFileName: ${file.filename}\nContent:\n${file.content}\n---`);
                }

                allGistsContent.push(
                    `Gist Title: ${gistTitle}\nDescription: ${gistData.description || 'N/A'}\nFiles:\n${fileContents.join('\n')}`
                );
            }

            loadingStatusElement.textContent = `Scan complete. Processed ${allGistsContent.length} of ${totalGists} Gists found.`;
            
            // 4. Create the final prompt
            const llmPrompt = `Based on the following Gist files I have created, find the most relevant function to solve my problem.\n\nProblem: [**DESCRIBE YOUR PROBLEM HERE**]\n\n--- GIST DATABASE ---\n\n${allGistsContent.join('\n\n')}`;
            
            outputElement.textContent = llmPrompt;

        } catch (error) {
            outputElement.textContent = `An error occurred: ${error.message}`;
            loadingStatusElement.textContent = 'Scan failed.';
        }
    });

    // Event listener for the copy button
    copyButton.addEventListener('click', () => {
        const textToCopy = outputElement.textContent;
        if (textToCopy && textToCopy !== 'The generated prompt will appear here...') {
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = 'Copy Prompt';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                outputElement.textContent = 'Failed to copy text. Please copy manually.';
            });
        }
    });
});