const { runPipeline } = require('./pipeline-engine');
const fs = require('fs');

async function main() {
  const content = fs.readFileSync('demo-hr.txt', 'utf-8');
  console.log('Starting DEEP diagnosis (7 Agents)...\n');
  
  const result = await runPipeline(content, 'demo-hr.txt', 'deep_diagnosis', (progress) => {
    if (progress.status === 'running') {
      console.log(`[${progress.stage + 1}/7] ${progress.stageEmoji} ${progress.stageName} running...`);
    } else {
      console.log(`[${progress.stage + 1}/7] ${progress.stageEmoji} ${progress.stageName} DONE`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('DEEP DIAGNOSIS COMPLETE! Elapsed: ' + result.elapsedSeconds + 's');
  console.log('='.repeat(60) + '\n');
  
  // Save all stages
  const allOutput = result.stages.map((s, i) => {
    return `# Stage ${i+1}: ${s.emoji} ${s.name}\n\n${s.output}\n\n---\n`;
  }).join('\n');
  fs.writeFileSync('deep-analysis-output.md', allOutput, 'utf-8');
  
  // Output final report
  console.log(result.stages[result.stages.length - 1].output);
  
  result.stages.forEach((s, i) => {
    const len = s.output.length;
    console.log(`[Stage ${i+1}] ${s.emoji} ${s.name}: ${len} chars`);
  });
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
