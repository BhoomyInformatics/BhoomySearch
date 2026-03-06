const fs = require('fs');
const path = require('path');
const https = require('https');

// Mermaid Live Editor API endpoint for rendering
const MERMAID_API = 'https://mermaid.ink/img/';

/**
 * Encode Mermaid diagram for URL
 */
function encodeMermaid(diagram) {
    return encodeURIComponent(diagram);
}

/**
 * Download image from URL
 */
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`✓ Saved: ${filepath}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

/**
 * Extract Mermaid diagrams from markdown file
 */
function extractMermaidDiagrams(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const diagrams = [];
    
    // Match mermaid code blocks - handle different formats
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g;
    let match;
    let index = 0;
    
    while ((match = mermaidRegex.exec(content)) !== null) {
        let diagram = match[1].trim();
        
        // Try to extract a title from the surrounding context
        const beforeMatch = content.substring(0, match.index);
        const titleMatch = beforeMatch.match(/(?:^|\n)(#{1,6})\s+(.+?)(?:\n|$)/gm);
        let title = `diagram-${index + 1}`;
        
        if (titleMatch && titleMatch.length > 0) {
            // Get the last heading before this diagram
            const lastTitle = titleMatch[titleMatch.length - 1].replace(/^#+\s+/, '').trim();
            title = lastTitle.toLowerCase()
                .replace(/[^a-z0-9\s]+/g, '')
                .replace(/\s+/g, '-')
                .substring(0, 50);
        }
        
        diagrams.push({
            index: index++,
            title: title,
            code: diagram,
            startIndex: match.index,
            endIndex: match.index + match[0].length
        });
    }
    
    return diagrams;
}

/**
 * Render diagram to PNG using Mermaid.ink API
 */
async function renderDiagram(diagram, outputDir, baseName) {
    const encoded = encodeMermaid(diagram.code);
    const url = `${MERMAID_API}${encoded}`;
    const filename = `${baseName}-${diagram.title || diagram.index}.png`;
    const filepath = path.join(outputDir, filename);
    
    console.log(`Rendering diagram ${diagram.index + 1}: ${filename}...`);
    
    try {
        await downloadImage(url, filepath);
        return filepath;
    } catch (error) {
        console.error(`Error rendering diagram ${diagram.index + 1}:`, error.message);
        // Try alternative method with svg
        const svgUrl = `https://mermaid.ink/svg/${encoded}`;
        const svgFilename = `${baseName}-${diagram.title || diagram.index}.svg`;
        const svgFilepath = path.join(outputDir, svgFilename);
        
        try {
            await downloadImage(svgUrl, svgFilepath);
            console.log(`✓ Saved SVG instead: ${svgFilepath}`);
            return svgFilepath;
        } catch (svgError) {
            console.error(`Error rendering SVG:`, svgError.message);
            return null;
        }
    }
}

/**
 * Main function
 */
async function main() {
    const docsDir = __dirname;
    const outputDir = path.join(docsDir, 'diagrams');
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const files = [
        {
            path: path.join(docsDir, 'visual-architecture-diagram.md'),
            baseName: 'architecture'
        },
        {
            path: path.join(docsDir, 'visual-functional-flow-diagram.md'),
            baseName: 'functional-flow'
        }
    ];
    
    console.log('Starting diagram rendering...\n');
    
    for (const file of files) {
        if (!fs.existsSync(file.path)) {
            console.error(`File not found: ${file.path}`);
            continue;
        }
        
        console.log(`\nProcessing: ${path.basename(file.path)}`);
        const diagrams = extractMermaidDiagrams(file.path);
        console.log(`Found ${diagrams.length} diagrams\n`);
        
        for (const diagram of diagrams) {
            await renderDiagram(diagram, outputDir, file.baseName);
            // Add small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('\n✓ All diagrams rendered!');
    console.log(`Output directory: ${outputDir}`);
}

// Run the script
main().catch(console.error);

