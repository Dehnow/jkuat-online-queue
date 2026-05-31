// Script to update queue creation logic with golden ticket eligibility
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'api-server.js');
let content = fs.readFileSync(filePath, 'utf8');

// Strategy: Find the line with "Queue entry created:" and work backwards to find the pattern
const lines = content.split('\n');

// Find the index where we should make changes
let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("Queue entry created:") && i > 400) {
    // Found it, work backwards
    endIdx = i;
    // Find the start of the insert statement
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j].includes('.insert(queueEntries)')) {
        startIdx = j - 5; // Get a few lines before
        break;
      }
    }
    break;
  }
}

if (startIdx !== -1 && endIdx !== -1) {
  console.log(`Found section from line ${startIdx} to ${endIdx}`);
  
  // Extract the lines that need replacement
  const oldLines = lines.slice(startIdx, endIdx + 5);
  console.log('Old section:');
  oldLines.forEach((line, idx) => console.log(`${startIdx + idx}: ${line}`));
  
  // Build the replacement
  const newLines = [
    lines[startIdx], // "    // Get next queue number" or similar
    '',
    `    const nextQueueNumber = (lastEntry?.maxQueue ?? 0) + 1`,
    `    console.log(\`INFO: Next queue number for \${serviceType}: \${nextQueueNumber}\`)`,
    '',
    `    // GOLDEN TICKET LOGIC: Disable golden upgrade on all previous tickets by this student`,
    `    // Golden ticket opportunity only applies to the most recent ticket`,
    `    await db`,
    `      .update(queueEntries)`,
    `      .set({ canUpgradeToGolden: false })`,
    `      .where(eq(queueEntries.studentId, studentId))`,
    `    `,
    `    console.log(\`INFO: Disabled golden upgrade for all previous tickets by \${studentId}\`)`,
    '',
    `    // Create new entry with canUpgradeToGolden=true (this is the most recent ticket)`,
    `    const newEntry = await db`,
    `      .insert(queueEntries)`,
    `      .values({`,
    `        name,`,
    `        studentId,`,
    `        serviceType,`,
    `        queueNumber: nextQueueNumber,`,
    `        status: 'waiting',`,
    `        officeId,`,
    `        canUpgradeToGolden: true, // New ticket is eligible for golden upgrade`,
    `      })`,
    `      .returning()`,
    '',
    `    console.log('SUCCESS: Queue entry created:', newEntry[0])`,
    `    console.log('INFO: New ticket is eligible for golden upgrade')`,
    `    `,
    `    res.status(201).json({`,
    `      ...newEntry[0],`,
    `      goldenTicketEligible: true,`,
    `      message: 'You can upgrade this ticket to a Golden Ticket for priority access!'`,
    `    })`,
  ];
  
  // Replace the section
  lines.splice(startIdx, endIdx - startIdx + 5, ...newLines);
  
  const updatedContent = lines.join('\n');
  fs.writeFileSync(filePath, updatedContent, 'utf8');
  console.log('\nSuccessfully updated api-server.js with golden ticket eligibility logic');
} else {
  console.log('Could not find the section to update');
}
