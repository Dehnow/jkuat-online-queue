import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const outputName = 'DOCUMENTATION.md'
const entries = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name !== outputName)
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right))

const documents = await Promise.all(entries.map(async (name) => ({
  name,
  content: await readFile(path.join(root, name), 'utf8'),
})))

const lines = [
  '# JKUAT Online Queue System Documentation',
  '',
  '> Consolidated documentation generated from the repository Markdown files. Original source files are preserved.',
  '',
  `Generated from ${documents.length} source documents.`,
  '',
  '## Table of Contents',
  '',
  ...documents.map(({ name }) => `- [${name}](#${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')})`),
  '',
]

for (const { name, content } of documents) {
  lines.push(`## ${name}`, '', content.trim(), '', '---', '')
}

await writeFile(path.join(root, outputName), `${lines.join('\n')}\n`, 'utf8')
console.log(`Wrote ${outputName} from ${documents.length} Markdown files.`)
