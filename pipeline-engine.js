/**
 * HR精灵 — Pipeline 引擎
 * 
 * 核心逻辑：把 7 个人力资源 AI Agent 的 System Prompt 按顺序串起来，
 * 依次调用 DeepSeek API，前一步输出 → 下一步输入。
 * 
 * 架构与「财报精灵」一致，Agent 定义和 Pipeline 不同。
 */
const fs = require('fs');
const path = require('path');

// ── 配置 ──
const AGENTS_DIR = path.join(__dirname, 'agents');
const KEY_FILE = path.join(require('os').homedir(), '.hr-elf-api-key');

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

// ── API Key 管理 ──
function saveApiKey(key) {
  fs.writeFileSync(KEY_FILE, key.trim(), 'utf-8');
}

function getApiKey() {
  try {
    return fs.readFileSync(KEY_FILE, 'utf-8').trim();
  } catch {
    return null;
  }
}

// ── 读取 Agent System Prompt ──
function loadAgentPrompt(agentId) {
  const soulPath = path.join(AGENTS_DIR, agentId, 'SOUL.md');
  let prompt = '';

  if (fs.existsSync(soulPath)) {
    prompt += fs.readFileSync(soulPath, 'utf-8').trim();
  }

  return prompt;
}

// ── 调用 DeepSeek API ──
async function callLLM(systemPrompt, userMessage, onChunk) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API Key 未配置，请在设置中填入 DeepSeek API Key');
  }

  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.3,
    max_tokens: 8192,
    stream: !!onChunk
  });

  if (!onChunk) {
    const res = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API 调用失败 (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  // 流式
  const response = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API 调用失败 (${response.status}): ${err}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          if (onChunk) onChunk(content);
        }
      } catch { /* 跳过解析错误的行 */ }
    }
  }

  return fullContent;
}

// ── Pipeline 阶段定义 ──
const PIPELINES = {
  // 快速概览：招聘专家 → 风险审计师
  quick_overview: {
    name: '快速概览',
    steps: [
      { id: 'recruitment-expert', name: '招聘效能专家', emoji: '🔍', desc: '提取招聘核心指标与关键发现' },
      { id: 'risk-auditor', name: '人力风险审计师', emoji: '🔴', desc: '标注核心人力风险点' }
    ]
  },

  // 标准分析：招聘专家 → 绩效分析师 → 薪酬顾问 → 报告总监
  standard_analysis: {
    name: '标准分析',
    steps: [
      { id: 'recruitment-expert', name: '招聘效能专家', emoji: '🔍', desc: '招聘漏斗、渠道ROI、储备率分析' },
      { id: 'performance-analyst', name: '绩效分析专家', emoji: '⚖️', desc: '绩效分布、公平性、人效分析' },
      { id: 'compensation-advisor', name: '薪酬福利顾问', emoji: '💰', desc: '薪酬结构、公平性、竞争力评估' },
      { id: 'report-writer', name: 'HR报告总监', emoji: '📋', desc: '整合分析，输出完整诊断报告' }
    ]
  },

  // 深度诊断：7 个 Agent 接力
  deep_diagnosis: {
    name: '深度诊断',
    steps: [
      { id: 'recruitment-expert', name: '招聘效能专家', emoji: '🔍', desc: '招聘全链路深度分析' },
      { id: 'performance-analyst', name: '绩效分析专家', emoji: '⚖️', desc: '绩效体系全景诊断' },
      { id: 'compensation-advisor', name: '薪酬福利顾问', emoji: '💰', desc: '薪酬竞争力与公平性评估' },
      { id: 'training-planner', name: '培训发展规划师', emoji: '🎓', desc: '培训体系与人才梯队诊断' },
      { id: 'culture-diagnostician', name: '组织文化诊断师', emoji: '🏛️', desc: '敬业度与组织健康度评估' },
      { id: 'risk-auditor', name: '人力风险审计师', emoji: '🔴', desc: '全面合规与运营风险排查' },
      { id: 'report-writer', name: 'HR报告总监', emoji: '📋', desc: '整合所有分析，出具终审报告' }
    ]
  }
};

// ── 运行 Pipeline ──
async function runPipeline(content, fileName, pipelineType, onProgress) {
  const pipeline = PIPELINES[pipelineType];
  if (!pipeline) {
    throw new Error(`未知的分析模式: ${pipelineType}`);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('未配置 API Key，请在左侧面板填入 DeepSeek API Key');
  }

  const results = { stages: [], finalReport: '' };
  let previousOutput = '';
  const startTime = Date.now();

  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i];
    const systemPrompt = loadAgentPrompt(step.id);

    if (!systemPrompt) {
      throw new Error(`未找到 Agent "${step.id}" 的配置文件`);
    }

    let userMessage;
    if (i === 0) {
      userMessage = `请对以下企业人力资源数据进行分析。\n\n文件名：${fileName}\n\n人力资源数据：\n\n${content}`;
    } else {
      userMessage = `请基于以下上一阶段的分析产出，进行本阶段的工作。\n\n---\n原文件名：${fileName}\n\n上一阶段产出：\n\n${previousOutput}\n\n---\n\n原始人力资源数据（备查）：\n\n${content}`;
    }

    if (onProgress) {
      onProgress({
        stage: i,
        stageName: step.name,
        stageEmoji: step.emoji,
        stageDesc: step.desc,
        status: 'running',
        totalStages: pipeline.steps.length
      });
    }

    const output = await callLLM(systemPrompt, userMessage);
    previousOutput = output;

    results.stages.push({
      name: step.name,
      emoji: step.emoji,
      agentId: step.id,
      output
    });

    if (onProgress) {
      onProgress({
        stage: i,
        stageName: step.name,
        stageEmoji: step.emoji,
        stageDesc: step.desc,
        status: 'done',
        totalStages: pipeline.steps.length
      });
    }
  }

  results.finalReport = results.stages[results.stages.length - 1].output;
  results.elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  results.pipelineName = pipeline.name;

  return results;
}

// ── 列出可用的 Pipelines ──
function listPipelines() {
  return Object.entries(PIPELINES).map(([id, p]) => ({
    id,
    name: p.name,
    steps: p.steps.map(s => ({ name: s.name, emoji: s.emoji }))
  }));
}

// ── 内嵌 HTTP Server（供前端通过 REST API 调用）──
let server = null;
const PORT = 28999;

async function startServer() {
  server = require('http').createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204); res.end(); return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url.pathname === '/api/check-key') {
      const key = getApiKey();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasKey: !!key }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/save-key') {
      const body = await readBody(req);
      const { apiKey } = JSON.parse(body);
      saveApiKey(apiKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url.pathname === '/api/pipelines') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(listPipelines()));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/run-review') {
      const body = await readBody(req);
      const { content, fileName, pipelineType } = JSON.parse(body);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const send = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await runPipeline(content, fileName, pipelineType, (progress) => {
          send('progress', progress);
        });
        send('done', result);
      } catch (err) {
        send('error', { error: err.message });
      }

      res.end();
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`👥 HR精灵 Pipeline 引擎已启动，端口 ${PORT}`);
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
  });
}

// ── 导出 ──
module.exports = {
  saveApiKey,
  getApiKey,
  loadAgentPrompt,
  callLLM,
  runPipeline,
  listPipelines,
  startServer,
  stopServer
};
