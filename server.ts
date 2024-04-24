import express from 'express'
import { Octokit } from '@octokit/rest'
import rateLimit from 'express-rate-limit'
import { RequestError } from '@octokit/request-error' // Import Octokit RequestError for error handling

const app = express()
const port = 3000

// GitHub API client setup
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN, // Set your GitHub token in environment variables
})

// Rate limiter to prevent abuse
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
})

// Apply rate limiting middleware
app.use(limiter)

app.get('/', async (req, res) => {
    const { repoUrl } = req.query

    // Validate repo URL format
    if (
        typeof repoUrl !== 'string' ||
        !repoUrl.startsWith('https://github.com/The-Matrix-Labs/')
    ) {
        return res.status(400).send('Invalid repository URL.')
    }

    const [, , , owner, repo] = repoUrl.split('/')

    try {
        // Attempt to get the README file
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'README.md',
        })

        if (!('content' in data) || typeof data.content !== 'string') {
            throw new Error('README.md content not found.')
        }

        let content = Buffer.from(data.content, 'base64').toString('utf-8')
        content += ' ' // Add a space to the content

        // Update or create README.md
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: 'README.md',
            message: 'Update README.md',
            content: Buffer.from(content).toString('base64'),
            sha: data.sha, // Needed if updating the file
        })

        res.send('README updated successfully.')
    } catch (error) {
        if (error instanceof RequestError && error.status === 404) {
            // If README does not exist, create it
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'README.md',
                message: 'Create README.md',
                content: Buffer.from(' ').toString('base64'), // New README with a space
            })

            res.send('README created successfully.')
        } else {
            res.status(500).send('Error accessing GitHub API.')
        }
    }
})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
})
