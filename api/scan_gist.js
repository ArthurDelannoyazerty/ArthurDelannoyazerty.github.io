export default async function handler(request, response) {
    // 1. Securely get the API token from Vercel's environment variables.
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    // Get the filter type ('all' or 'python') from the query parameter.
    const { filter } = request.query;

    const authHeaders = {
        'Authorization': `token ${GITHUB_TOKEN}`
    };

    try {
        const repoOwner = 'ArthurDelannoyazerty';
        const repoName = 'my-gists';

        // 2. Fetch the README from your backend, using the secure token.
        const readmeUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/README.md`;
        const readmeResponse = await fetch(readmeUrl, {
            headers: { ...authHeaders, 'Accept': 'application/vnd.github.v3.raw' }
        });

        if (!readmeResponse.ok) {
            throw new Error(`Failed to fetch README: ${readmeResponse.statusText}`);
        }
        const readmeContent = await readmeResponse.text();

        const gistLinks = readmeContent.match(/https:\/\/gist\.github\.com\/[a-zA-Z0-9-]+\/[a-f0-9]+/g) || [];
        if (gistLinks.length === 0) {
            return response.status(200).json({ llmPrompt: 'No Gist links found in the README.md file.' });
        }

        let allGistsContent = [];

        // 3. Loop through Gists on the backend.
        for (const link of gistLinks) {
            const gistId = link.split('/').pop();
            const gistApiUrl = `https://api.github.com/gists/${gistId}`;
            const gistResponse = await fetch(gistApiUrl, { headers: authHeaders });

            if (!gistResponse.ok) continue;

            const gistData = await gistResponse.json();

            // Filtering logic
            if (filter === 'python') {
                const hasPythonFile = Object.values(gistData.files).some(file => file.language === 'Python' || file.filename.endsWith('.py'));
                if (!hasPythonFile) continue;
            }

            const gistTitle = gistData.description || 'No Title';
            let fileContents = Object.values(gistData.files).map(file => 
                `---\nFileName: ${file.filename}\nContent:\n${file.content}\n---`
            );
            
            allGistsContent.push(
                `Gist Title: ${gistTitle}\nDescription: ${gistData.description || 'N/A'}\nFiles:\n${fileContents.join('\n')}`
            );
        }

        const llmPrompt = `Based on the following Gist files I have created, find the most relevant function to solve my problem.\n\nProblem: [**DESCRIBE YOUR PROBLEM HERE**]\n\n--- GIST DATABASE ---\n\n${allGistsContent.join('\n\n')}`;
        
        // 4. Send the final prompt back to the frontend.
        response.status(200).json({ llmPrompt: llmPrompt });

    } catch (error) {
        // Send a detailed error message back to the frontend.
        response.status(500).json({ error: error.message });
    }
}