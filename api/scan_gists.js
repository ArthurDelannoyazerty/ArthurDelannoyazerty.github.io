// This function now streams Server-Sent Events (SSE)

export default async function handler(request, response) {
    // 1. Set headers for a streaming response
    response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    // Helper function to format and send an event
    const sendEvent = (eventName, data) => {
        response.write(`event: ${eventName}\n`);
        response.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const { filter } = request.query;

        const authHeaders = { 'Authorization': `token ${GITHUB_TOKEN}` };

        // --- Stage 1: Fetch README and find Gist links ---
        const readmeUrl = `https://api.github.com/repos/ArthurDelannoyazerty/my-gists/contents/README.md`;
        const readmeResponse = await fetch(readmeUrl, { headers: { ...authHeaders, 'Accept': 'application/vnd.github.v3.raw' } });
        if (!readmeResponse.ok) throw new Error(`Failed to fetch README: ${readmeResponse.statusText}`);
        
        const readmeContent = await readmeResponse.text();
        const gistLinks = readmeContent.match(/https:\/\/gist\.github\.com\/[a-zA-Z0-9-]+\/[a-f0-9]+/g) || [];

        // 2. Send the 'total' event with the number of gists found
        sendEvent('total', { count: gistLinks.length });

        // --- Stage 2: Loop through Gists and stream progress ---
        let processedCount = 0;
        for (let i = 0; i < gistLinks.length; i++) {
            const link = gistLinks[i];
            const gistId = link.split('/').pop();
            const gistApiUrl = `https://api.github.com/gists/${gistId}`;
            const gistResponse = await fetch(gistApiUrl, { headers: authHeaders });

            if (!gistResponse.ok) continue;

            const gistData = await gistResponse.json();

            // Apply filter
            if (filter === 'python') {
                const hasPythonFile = Object.values(gistData.files).some(file => file.language === 'Python' || file.filename.endsWith('.py'));
                if (!hasPythonFile) continue;
            }

            processedCount++;
            
            // 3. Send a 'progress' event with the current Gist's data
            sendEvent('progress', {
                index: processedCount,
                gist: gistData
            });
        }

        // --- Stage 3: Signal that the stream is done ---
        sendEvent('done', { message: 'Scan complete.', totalProcessed: processedCount });

    } catch (error) {
        // Send an 'error' event if something goes wrong
        sendEvent('error', { message: error.message });
    } finally {
        // 4. Close the connection
        response.end();
    }
}