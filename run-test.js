const { runPipeline } = require('./pipeline-engine');
const fs = require('fs');

async function main() {
  const content = fs.readFileSync('demo-hr.txt', 'utf-8');
  console.log('Starting standard analysis (4 Agents)...\n');
  
  const result = await runPipeline(content, 'demo-hr.txt', 'standard_analysis', (progress) => {
    if (progress.status === 'running') {
      console.log(`[${progress.stage + 1}/${progress.totalStages}] ${progress.stageEmoji} ${progress.stageName} running...`);
    } else {
      console.log(`[${progress.stage + 1}/${progress.totalStages}] ${progress.stageEmoji} ${progress.stageName} done`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('Analysis complete! Elapsed: ' + result.elapsedSeconds + 's');
  console.log('='.repeat(60) + '\n');
  
  // Save final report
  fs.writeFileSync('analysis-output.md', result.stages[result.stages.length - 1].output, 'utf-8');
  
  // Save all stages
  const allOutput = result.stages.map((s, i) => {
    return `# Stage ${i+1}: ${s.emoji} ${s.name}\n\n${s.output}\n\n---\n`;
  }).join('\n');
  fs.writeFileSync('analysis-output-full.md', allOutput, 'utf-8');
  
  console.log('Final report output:\n');
  console.log(result.stages[result.stages.length - 1].output);
  
  // Summary
  console.log('\n--- Stage Summary ---');
  result.stages.forEach((s, i) => {
    const preview = s.output.slice(0, 150).replace(/\n/g, ' ');
    console.log(`${i+1}. ${s.emoji} ${s.name}: ${preview}...`);
  });
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
