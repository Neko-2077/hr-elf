// 鈹€鈹€ App 鏍稿績閫昏緫 鈹€鈹€
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// 鈹€鈹€ 鐘舵€?鈹€鈹€
let state = {
  apiKeyReady: false,
  file: null,
  fileContent: '',
  textContent: null,
  pipelineType: 'standard_analysis',
  running: false
};
let lastResult=null;
const pipelines=[
  {id:'quick_overview',name:'蹇€熸瑙?,icon:'馃攳',steps:'鎷涜仒 鈫?椋庨櫓棰勮'},
  {id:'standard_analysis',name:'鏍囧噯鍒嗘瀽',icon:'馃搳',steps:'鎷涜仒 鈫?缁╂晥 鈫?钖叕 鈫?缁堝鎶ュ憡'},
  {id:'deep_diagnosis',name:'娣卞害璇婃柇',icon:'馃彞',steps:'鎷涜仒 鈫?缁╂晥 鈫?钖叕 鈫?鍩硅 鈫?鏂囧寲 鈫?椋庨櫓 鈫?缁堝'}
];

// 鈹€鈹€ 鍒濆鍖?鈹€鈹€
async function init() {
  // 妫€鏌?Key
  try {
    const result = await window.hrelf.checkKey();
    if (result.hasKey) {
      state.apiKeyReady = true;
      updateKeyUI(true, result.masked);
    }
  } catch (e) {
    // 闈?Electron 鐜锛堟祻瑙堝櫒璋冭瘯锛夛紝鐩存帴鍏佽杩愯
    console.log('闈?Electron 鐜');
    state.apiKeyReady = true;
    updateKeyUI(true, 'sk-***');
  }

  // 娓叉煋鍒嗘瀽妯″紡
  renderPipelineOpts();

  // 鎭㈠涓婃鍒嗘瀽缁撴灉 + 鍔犺浇鍘嗗彶鍒楄〃
  if(window.hrelf&&window.hrelf.loadLatest){
    try{
      var prev=await window.hrelf.loadLatest();
      if(prev&&prev.result){renderResult(prev.result,prev)}
    }catch(e){console.error('[init] loadLatest err:',e)}
    refreshHistoryList();
  }

  // 浜嬩欢缁戝畾
  $('#uploadZone').addEventListener('click', () => $('#fileInput').click());
  $('#uploadZone').addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
  $('#uploadZone').addEventListener('drop', handleDrop);
  $('#fileInput').addEventListener('change', handleFileSelect);
  $('#btnSaveKey').addEventListener('click', saveKey);
  $('#btnGo').addEventListener('click', startAnalysis);
  $('#linkGetKey').addEventListener('click', (e) => {
    e.preventDefault();
    require('electron').shell.openExternal('https://platform.deepseek.com/api_keys');
  });
  // 鏂囧瓧杈撳叆瀹炴椂鐩戝惉
  $('#textInput').addEventListener('input', function() {
    var len = $('#textInput').value.length;
    $('#charCount').textContent = len + ' / 50000 瀛?;
    state.textContent = $('#textInput').value.trim() || null;
    state.file = null; state.fileContent = '';
    $('#uploadZone').classList.remove('has-file');
    var fn = $('#uploadZone').querySelector('.file-name'); if (fn) fn.remove();
    $('#uploadZone').querySelector('.up-text').textContent = '鐐瑰嚮涓婁紶浜哄姏璧勬簮鏁版嵁';
    updateGoButton();
  });

  // 鍘嗗彶闈㈡澘
  $('#historyHeader').addEventListener('click',function(){
    var list=$('#historyList');
    var toggle=$('#historyToggle');
    var open=list.classList.contains('open');
    if(open){list.classList.remove('open');toggle.classList.remove('open')}
    else{list.classList.add('open');toggle.classList.add('open');refreshHistoryList()}
  });

  // 瀵煎嚭鎸夐挳
  $('#btnExportMd').addEventListener('click',function(){doExport('md')});
  $('#btnExportDocx').addEventListener('click',function(){doExport('docx')});
  $('#btnExportTxt').addEventListener('click',function(){doExport('txt')});
}

function updateKeyUI(ready, masked) {
  const dot = $('#keyDot');
  const label = $('#keyLabel');
  dot.className = 'kdot ' + (ready ? 'ok' : 'no');
  label.textContent = ready ? `宸查厤缃?(${masked})` : '鏈厤缃?API Key';
  updateGoButton();
}

function updateGoButton() {
  const btn = $('#btnGo');
  if (!state.file && !state.textContent) {
    btn.disabled = true;
    btn.textContent = '璇蜂笂浼?HR 鏁版嵁鎴栬緭鍏ユ枃瀛?;
  } else if (!state.apiKeyReady) {
    btn.disabled = true;
    btn.textContent = '璇峰厛閰嶇疆 API Key';
  } else if (state.running) {
    btn.disabled = true;
    btn.textContent = '鍒嗘瀽涓?..';
  } else {
    btn.disabled = false;
    btn.textContent = `寮€濮?{getPipelineName(state.pipelineType)}`;
  }
}

// 鈹€鈹€ 鏂囦欢澶勭悊 鈹€鈹€
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  state.file = file;
  readFile(file);
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  state.file = file;
  readFile(file);
}

function readFile(file) {
  state.file = file; state.textContent = null;
  $('#textInput').value = ''; $('#charCount').textContent = '0 / 50000 瀛?;
  const reader = new FileReader();
  reader.onload = (e) => {
    state.fileContent = e.target.result;
    $('#uploadZone').classList.add('has-file');
    $('#uploadZone').querySelector('.up-text').textContent = '宸查€夋嫨鏂囦欢';
    $('#uploadZone').querySelector('.file-name')?.remove();
    const el = document.createElement('div');
    el.className = 'file-name';
    el.textContent = file.name;
    $('#uploadZone').appendChild(el);
    updateGoButton();
  };
  reader.readAsText(file);
}

// 鈹€鈹€ Key 绠＄悊 鈹€鈹€
async function saveKey() {
  const key = $('#keyInput').value.trim();
  if (!key) return;
  try {
    await window.hrelf.saveKey(key);
    state.apiKeyReady = true;
    updateKeyUI(true, key.slice(0, 4) + '****' + key.slice(-4));
    $('#keyInput').value = '';
  } catch (e) {
    alert('淇濆瓨澶辫触: ' + e.message);
  }
}

// 鈹€鈹€ Pipeline 閫夋嫨 鈹€鈹€
function renderPipelineOpts() {
  const container = $('#pipeOpts');
  container.innerHTML = pipelines.map((p, i) => {
    const active = (i === 1) ? ' active' : '';
    return `<div class="pipe-opt${active}" data-pipe="${p.id}">
      <div class="p-top"><span class="p-icon">${p.icon}</span><span class="p-name">${p.name}</span></div>
      <div class="p-steps">${p.steps}</div>
    </div>`;
  }).join('');

  container.querySelectorAll('.pipe-opt').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.pipe-opt').forEach(e => e.classList.remove('active'));
      el.classList.add('active');
      state.pipelineType = el.dataset.pipe;
      updateGoButton();
    });
  });
}

function getPipelineName(id) {
  const map = { quick_overview: '蹇€熸瑙?, standard_analysis: '鏍囧噯鍒嗘瀽', deep_diagnosis: '娣卞害璇婃柇' };
  return map[id] || '鍒嗘瀽';
}

// 鈹€鈹€ 鍒嗘瀽娴佺▼ 鈹€鈹€
async function startAnalysis() {
  if (state.running || (!state.file && !state.textContent) || !state.apiKeyReady) return;
  state.running = true;
  $('#btnGo').classList.add('running');
  $('#btnGo').textContent = '鍒嗘瀽涓?..';
  $('#btnGo').disabled = true;

  // 鍒囨崲瑙嗗浘
  $('#emptyState').style.display = 'none';
  $('#resultPanel').classList.remove('visible');
  $('#progressPanel').classList.add('visible');

  var content = state.fileContent || state.textContent;
  var fileName = state.file ? state.file.name : ('鎵嬪姩杈撳叆锛? + content.length + '瀛楋級');

  try {
    const result = await window.hrelf.runReview({
      content: content,
      fileName: fileName,
      pipelineType: state.pipelineType
    });

    // 娓叉煋缁撴灉
    renderResult(result);
  } catch (err) {
    alert('鍒嗘瀽澶辫触: ' + err.message);
  } finally {
    state.running = false;
    $('#btnGo').classList.remove('running');
    updateGoButton();
  }
}

// 鈹€鈹€ 缁撴灉娓叉煋 鈹€鈹€
function renderResult(result,historyItem){
  // 琛ュ叏 meta
  lastResult=result;
  lastResult.fileName=lastResult.fileName||(historyItem?historyItem.fileName:null)||(state.file?state.file.name:null)||('鎵嬪姩杈撳叆');
  lastResult.pipelineName=lastResult.pipelineName||(pipelines.find(function(p){return p.id===state.pipelineType})||pipelines[1]).name;
  $('#progressPanel').classList.remove('visible');
  $('#resultPanel').classList.add('visible');

  // Meta
  var pipe=pipelines.find(function(p){return p.name===lastResult.pipelineName})||pipelines[1];
  $('#resultMeta').innerHTML = `
    <span class="meta-item">${pipe.icon} <strong>${lastResult.pipelineName}</strong></span>
    <span class="meta-item">鈴?鑰楁椂 ${result.elapsedSeconds}s</span>
    <span class="meta-item">馃 ${result.stages.length} 浣?Agent</span>
    <span class="meta-item">馃搫 ${lastResult.fileName}</span>
  `;

  // Tabs
  let tabsHtml = '';
  let contentsHtml = '';
  result.stages.forEach((stage, i) => {
    const active = i === result.stages.length - 1 ? ' active' : '';
    tabsHtml += `<button class="result-tab${active}" data-tab="${i}">${stage.emoji} ${stage.name}</button>`;
    contentsHtml += `<div class="result-tab-content${active}" data-content="${i}">
      <div class="result-body">${markdownToHtml(stage.output)}</div>
    </div>`;
  });

  $('#resultTabs').innerHTML = tabsHtml;
  $('#resultTabContents').innerHTML = contentsHtml;

  // Tab 鍒囨崲
  $('#resultTabs').querySelectorAll('.result-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = tab.dataset.tab;
      $$('.result-tab').forEach(t => t.classList.remove('active'));
      $$('.result-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $(`.result-tab-content[data-content="${idx}"]`).classList.add('active');
    });
  });

  $('#mainContent').scrollTop = 0;
  refreshHistoryList();
}

// 鈹€鈹€ 绠€鍗曠殑 Markdown 鈫?HTML 鈹€鈹€
function markdownToHtml(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/<p><\/p>/g, '')
    .replace(/^(?!<)/gm, (line) => line ? `<p>${line}</p>` : '');
}

// 鈹€鈹€ 鍘嗗彶鍒楄〃 鈹€鈹€
async function refreshHistoryList(){
  if(!window.hrelf||!window.hrelf.loadHistory)return;
  try{
    var history=await window.hrelf.loadHistory();
    var list=$('#historyList');
    if(!history.length){list.innerHTML='<div class="history-item" style="color:var(--text3)">鏆傛棤鍘嗗彶璁板綍</div>';return}
    list.innerHTML=history.map(function(h,i){
      var pipeName=pipelines.find(function(p){return p.id===h.pipelineType});
      pipeName=pipeName?pipeName.name:'鍒嗘瀽';
      var time=new Date(h.time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
      var fn=(h.fileName||'').replace(/\.(txt|md)$/i,'');
      return '<div class="history-item" onclick="loadHistoryItem('+i+')"><span class="hi-name">'+pipeName+' 路 '+fn+'</span><span class="hi-time">'+time+'</span></div>';
    }).join('');
  }catch(e){console.error('[refreshHistoryList]',e)}
}

window.loadHistoryItem=async function(idx){
  try{
    var history=await window.hrelf.loadHistory();
    var item=history[idx];
    if(item&&item.result){
      item.result.fileName=item.fileName;
      item.result.pipelineName=pipelines.find(function(p){return p.id===item.pipelineType}).name;
      renderResult(item.result,item);
      $('#historyList').classList.remove('open');
      $('#historyToggle').classList.remove('open');
    }
  }catch(e){console.error('[loadHistoryItem]',e)}
};

// 鈹€鈹€ 瀵煎嚭鍔熻兘 鈹€鈹€
function buildReportMarkdown(r){
  var lines=[];
  var pipeName=r.pipelineName||'鏍囧噯鍒嗘瀽';
  lines.push('# '+pipeName+' 鎶ュ憡');
  lines.push('');
  lines.push('> 鐢熸垚鏃堕棿锛?+new Date().toLocaleString());
  lines.push('> 鑰楁椂锛?+(r.elapsedSeconds||'?')+' 绉?);
  lines.push('');
  var ss=r.stages||[];
  for(var i=0;i<ss.length;i++){
    var s=ss[i];
    lines.push('## '+s.emoji+' '+s.name);
    lines.push('');
    lines.push(s.output||'(鏃犺緭鍑?');
    lines.push('');
  }
  return lines.join('\n');
}

async function doExport(format){
  if(!lastResult){alert('娌℃湁鍙鍑虹殑鎶ュ憡');return}
  var pipeName=lastResult.pipelineName||'鍒嗘瀽';
  var fn=lastResult.fileName||('鎵嬪姩杈撳叆');
  var content,defaultName,filters;
  if(format==='docx'){
    var h='<html><head><meta charset="UTF-8"><title>'+pipeName+'鎶ュ憡</title>';
    h+='<style>body{font-family:"Noto Sans SC",sans-serif;line-height:1.8;max-width:780px;margin:40px auto;color:#0f172a}h1{border-bottom:2px solid #7c3aed;padding-bottom:8px}h2{border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-top:1.4em}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #cbd5e1;padding:8px 12px}th{background:#f1f5f9}</style></head><body>';
    h+='<h1>'+pipeName+' 鎶ュ憡</h1>';
    h+='<p>鐢熸垚鏃堕棿锛?+new Date().toLocaleString()+' | 鑰楁椂锛?+(lastResult.elapsedSeconds||'?')+' 绉?/p>';
    var ss=lastResult.stages||[];
    for(var i=0;i<ss.length;i++){h+='<h2>'+ss[i].emoji+' '+ss[i].name+'</h2>';h+=markdownToHtml(ss[i].output||'(鏃犺緭鍑?')}
    h+='</body></html>';
    content=h;
    defaultName=pipeName+'鎶ュ憡_'+fn.replace(/\.[^.]+$/,'')+'.doc';
    filters=[{name:'Word 鏂囨。',extensions:['doc','docx']}];
  }else if(format==='md'){
    content=buildReportMarkdown(lastResult);
    defaultName=pipeName+'鎶ュ憡_'+fn.replace(/\.[^.]+$/,'')+'.md';
    filters=[{name:'Markdown',extensions:['md']}];
  }else{
    content=buildReportMarkdown(lastResult).replace(/^#+ /gm,'').replace(/\*\*/g,'').replace(/\*/g,'').replace(/`/g,'').replace(/^> /gm,'');
    defaultName=pipeName+'鎶ュ憡_'+fn.replace(/\.[^.]+$/,'')+'.txt';
    filters=[{name:'绾枃鏈?,extensions:['txt']}];
  }
  if(window.hrelf&&window.hrelf.exportFile){
    var res=await window.hrelf.exportFile({content:content,defaultName:defaultName,filters:filters});
    if(!res.success){if(res.error)alert('瀵煎嚭澶辫触: '+res.error)}
  }else{
    var blob=new Blob([content],{type:format==='docx'?'text/html':'text/plain;charset=utf-8'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=defaultName;a.click();
  }
}

init();
