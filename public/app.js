const fileForm = document.getElementById('fileForm');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const previewEl = document.getElementById('preview');
const fileInput = document.getElementById('fileInput');

function showStatus(text) { statusEl.textContent = text; statusEl.style.color = '#111'; }
function showError(text) { statusEl.textContent = text; statusEl.style.color = 'crimson'; }
function clearStatus() { statusEl.textContent = ''; }

function showPreviewFromUrl(url){
  previewEl.innerHTML = '';
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Preview';
  img.onload = () => {};
  img.onerror = () => { previewEl.textContent = 'No se pudo cargar la imagen'; };
  previewEl.appendChild(img);
}

function showPreviewFromFile(file){
  previewEl.innerHTML = '';
  const img = document.createElement('img');
  const reader = new FileReader();
  reader.onload = e => { img.src = e.target.result; previewEl.appendChild(img); };
  reader.onerror = () => { previewEl.textContent = 'No se pudo leer el archivo'; };
  reader.readAsDataURL(file);
}

// 🎭 NUEVO: Detectar rostros en la imagen actual
async function detectFaces() {
  if (!previewEl.querySelector('img')) {
    showError('Primero carga una imagen para detectar rostros');
    return;
  }

  showStatus('Detectando rostros...');
  
  try {
    const imgEl = previewEl.querySelector('img');
    const isUrl = imgEl.src.startsWith('http');
    
    let response;
    if (isUrl) {
      response = await fetch('/api/detect-faces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imgEl.src })
      });
    } else {
      // Si es un archivo local (data URL), necesitamos subirlo primero
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.width;
      canvas.height = imgEl.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      canvas.toBlob(blob => {
        const fd = new FormData();
        fd.append('image', blob);
        fetch('/api/detect-faces', { method: 'POST', body: fd }).then(r => r.json()).then(json => {
          clearStatus();
          renderFaceDetectionResults(json);
        });
      });
      return;
    }

    const json = await response.json();
    clearStatus();
    
    if (!response.ok) {
      showError('Error detectando rostros: ' + (json.error || 'Desconocido'));
      return;
    }

    renderFaceDetectionResults(json);
  } catch (err) {
    showError('Error de red: ' + err.message);
  }
}

function renderResponse(json) {
  resultsEl.innerHTML = '';
  if (!json || !json.data) { resultsEl.textContent = JSON.stringify(json); return; }
  
  // Renderizar análisis contextual completo
  if (json.context) {
    renderAdvancedSceneContext(json.context);
  }
  
  const data = json.data;
  const tags = (data.result && data.result.tags) || [];

  // Título de etiquetas (siempre mostrar)
  const tagsTitle = document.createElement('h3');
  tagsTitle.textContent = '📌 Todas las Etiquetas Detectadas';
  tagsTitle.style.marginTop = '1.5rem';
  tagsTitle.style.marginBottom = '0.8rem';
  tagsTitle.style.fontSize = '0.95rem';
  tagsTitle.style.fontWeight = '600';
  tagsTitle.style.borderBottom = '2px solid #2b6cb0';
  tagsTitle.style.paddingBottom = '0.5rem';
  resultsEl.appendChild(tagsTitle);

  if (tags.length === 0) {
    const noTags = document.createElement('p');
    noTags.style.color = '#6b7280';
    noTags.textContent = 'No se encontraron etiquetas.';
    resultsEl.appendChild(noTags);
    return;
  }

  tags.forEach(t => {
    const container = document.createElement('div');
    container.className = 'tag';

    const name = document.createElement('div');
    name.textContent = t.tag && t.tag.en ? t.tag.en : '—';
    name.style.fontWeight = '600';
    name.style.fontSize = '0.85rem';

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '8px';

    const percent = Math.max(0, Math.min(100, (t.confidence || 0).toFixed(1)));
    const pctText = document.createElement('div');
    pctText.textContent = `${percent}%`;
    pctText.style.minWidth = '46px';
    pctText.style.textAlign = 'right';
    pctText.style.fontSize = '0.8rem';
    pctText.style.fontWeight = '500';

    const barWrap = document.createElement('div');
    barWrap.className = 'bar';
    barWrap.style.minWidth = '100px';
    const bar = document.createElement('i');
    bar.style.width = `${percent}%`;
    barWrap.appendChild(bar);

    right.appendChild(barWrap);
    right.appendChild(pctText);

    container.appendChild(name);
    container.appendChild(right);
    resultsEl.appendChild(container);
  });
}

function renderAdvancedSceneContext(context) {
  // 1. Análisis de Escena Principal
  const sceneSection = document.createElement('div');
  sceneSection.style.cssText = `
    padding: 1rem;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-left: 4px solid #2b6cb0;
    border-radius: 8px;
    margin-bottom: 1.2rem;
  `;
  
  const sceneTitle = document.createElement('div');
  sceneTitle.style.cssText = 'font-weight: 700; font-size: 1rem; color: #1e40af; margin-bottom: 0.6rem;';
  sceneTitle.textContent = '🎬 ANÁLISIS DE ESCENA';
  sceneSection.appendChild(sceneTitle);

  if (context.scene_analysis) {
    const scene = context.scene_analysis;
    
    // Descripción
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size: 0.9rem; color: #111; margin-bottom: 0.8rem; line-height: 1.5;';
    desc.textContent = scene.description;
    sceneSection.appendChild(desc);

    // Grid de datos de escena
    const sceneGrid = document.createElement('div');
    sceneGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; font-size: 0.85rem;';
    
    const sceneItems = [
      { label: '🎯 Tipo', value: scene.type },
      { label: '📍 Ambiente', value: scene.setting },
      { label: '😊 Mood', value: scene.mood },
      { label: '⭐ Tema Principal', value: scene.dominant_theme }
    ];
    
    sceneItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.style.cssText = 'background: white; padding: 0.6rem; border-radius: 6px; border-left: 3px solid #60a5fa;';
      itemDiv.innerHTML = `<div style="font-weight: 600; color: #1e40af; font-size: 0.8rem;">${item.label}</div>
                           <div style="color: #111; margin-top: 0.3rem;">${item.value}</div>`;
      sceneGrid.appendChild(itemDiv);
    });
    
    sceneSection.appendChild(sceneGrid);
  }
  
  resultsEl.appendChild(sceneSection);

  // 2. Objetos Detectados
  if (context.objects_detected && context.objects_detected.high_confidence.length > 0) {
    const objSection = document.createElement('div');
    objSection.style.marginBottom = '1.2rem';
    
    const objTitle = document.createElement('h3');
    objTitle.style.cssText = 'margin: 0 0 0.8rem 0; font-size: 0.95rem; font-weight: 700; color: #111; border-bottom: 2px solid #fbbf24; padding-bottom: 0.5rem;';
    objTitle.textContent = '🔍 OBJETOS DETECTADOS (CONFIANZA ALTA)';
    objSection.appendChild(objTitle);

    const objGrid = document.createElement('div');
    objGrid.style.cssText = 'display: grid; gap: 0.6rem;';
    
    context.objects_detected.high_confidence.slice(0, 5).forEach(obj => {
      const objDiv = document.createElement('div');
      objDiv.style.cssText = `
        padding: 0.6rem 0.8rem;
        background: #fef3c7;
        border-left: 3px solid #f59e0b;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      
      const nameDiv = document.createElement('div');
      nameDiv.style.cssText = 'font-weight: 600; color: #111;';
      nameDiv.textContent = obj.name;
      
      const confDiv = document.createElement('div');
      confDiv.style.cssText = `
        background: white;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
        font-weight: 600;
        color: #d97706;
        font-size: 0.85rem;
      `;
      confDiv.textContent = `${obj.confidence}% - ${obj.level}`;
      
      objDiv.appendChild(nameDiv);
      objDiv.appendChild(confDiv);
      objGrid.appendChild(objDiv);
    });
    
    objSection.appendChild(objGrid);
    resultsEl.appendChild(objSection);
  }

  // 3. Análisis de Colores Avanzado
  if (context.color_analysis && context.color_analysis.dominant.length > 0) {
    const colorSection = document.createElement('div');
    colorSection.style.marginBottom = '1.2rem';
    
    const colorTitle = document.createElement('h3');
    colorTitle.style.cssText = 'margin: 0 0 0.8rem 0; font-size: 0.95rem; font-weight: 700; color: #111; border-bottom: 2px solid #a78bfa; padding-bottom: 0.5rem;';
    colorTitle.textContent = '🎨 ANÁLISIS DE COLORES';
    colorSection.appendChild(colorTitle);

    // Colores dominantes
    const colorGrid = document.createElement('div');
    colorGrid.style.cssText = 'display: grid; gap: 0.6rem; margin-bottom: 1rem;';
    
    context.color_analysis.dominant.forEach(color => {
      const colorDiv = document.createElement('div');
      colorDiv.style.cssText = 'display: flex; gap: 0.8rem; align-items: center; padding: 0.6rem; background: #f8f9fa; border-radius: 6px;';
      
      const colorBox = document.createElement('div');
      colorBox.style.cssText = `
        width: 48px;
        height: 48px;
        background-color: ${color.hex};
        border-radius: 6px;
        border: 2px solid #e6edf3;
        flex-shrink: 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      `;
      
      const colorInfo = document.createElement('div');
      colorInfo.style.cssText = 'flex: 1;';
      colorInfo.innerHTML = `
        <div style="font-weight: 700; color: #111; font-size: 0.9rem;">${color.name}</div>
        <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.2rem;">${color.hex} • RGB(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})</div>
        <div style="font-size: 0.8rem; color: #111; margin-top: 0.3rem;">Porcentaje: <strong>${color.percentage}%</strong> | Brillo: <strong>${color.brightness}</strong>/100</div>
      `;
      
      colorDiv.appendChild(colorBox);
      colorDiv.appendChild(colorInfo);
      colorGrid.appendChild(colorDiv);
    });
    
    colorSection.appendChild(colorGrid);

    // Métricas de color
    const colorMetrics = document.createElement('div');
    colorMetrics.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;';
    
    const harmonyDiv = document.createElement('div');
    harmonyDiv.style.cssText = 'background: #f3f4f6; padding: 0.6rem; border-radius: 6px; border-left: 3px solid #8b5cf6;';
    harmonyDiv.innerHTML = `<div style="font-weight: 600; font-size: 0.8rem; color: #6b21a8;">Armonía de Colores</div><div style="color: #111; font-weight: 600; margin-top: 0.3rem;">${context.color_analysis.color_harmony}</div>`;
    
    const brightnessDiv = document.createElement('div');
    brightnessDiv.style.cssText = 'background: #f3f4f6; padding: 0.6rem; border-radius: 6px; border-left: 3px solid #f59e0b;';
    brightnessDiv.innerHTML = `<div style="font-weight: 600; font-size: 0.8rem; color: #92400e;">Brillo Promedio</div><div style="color: #111; font-weight: 600; margin-top: 0.3rem;">${context.color_analysis.avg_brightness}/100</div>`;
    
    const vibrancyDiv = document.createElement('div');
    vibrancyDiv.style.cssText = 'background: #f3f4f6; padding: 0.6rem; border-radius: 6px; border-left: 3px solid #ec4899;';
    vibrancyDiv.innerHTML = `<div style="font-weight: 600; font-size: 0.8rem; color: #831843;">Vibración de Colores</div><div style="color: #111; font-weight: 600; margin-top: 0.3rem;">${context.composition_metrics.vibrancy}</div>`;
    
    const complexityDiv = document.createElement('div');
    complexityDiv.style.cssText = 'background: #f3f4f6; padding: 0.6rem; border-radius: 6px; border-left: 3px solid #06b6d4;';
    complexityDiv.innerHTML = `<div style="font-weight: 600; font-size: 0.8rem; color: #164e63;">Complejidad Visual</div><div style="color: #111; font-weight: 600; margin-top: 0.3rem;">${context.composition_metrics.complexity}</div>`;
    
    colorMetrics.appendChild(harmonyDiv);
    colorMetrics.appendChild(brightnessDiv);
    colorMetrics.appendChild(vibrancyDiv);
    colorMetrics.appendChild(complexityDiv);
    
    colorSection.appendChild(colorMetrics);
    resultsEl.appendChild(colorSection);
  }

  // 4. Etiquetas por Categoría
  if (context.tags_by_category) {
    const categorySection = document.createElement('div');
    categorySection.style.marginBottom = '1.2rem';
    
    const catTitle = document.createElement('h3');
    catTitle.style.cssText = 'margin: 0 0 0.8rem 0; font-size: 0.95rem; font-weight: 700; color: #111; border-bottom: 2px solid #10b981; padding-bottom: 0.5rem;';
    catTitle.textContent = '📂 ETIQUETAS POR CATEGORÍA';
    categorySection.appendChild(catTitle);

    const categories = [
      { key: 'entities', icon: '👥', label: 'Entidades' },
      { key: 'environment', icon: '🌍', label: 'Ambiente' },
      { key: 'attributes', icon: '✨', label: 'Atributos' },
      { key: 'actions', icon: '⚡', label: 'Acciones' },
      { key: 'concepts', icon: '💡', label: 'Conceptos' }
    ];

    categories.forEach(cat => {
      const tags = context.tags_by_category[cat.key] || [];
      if (tags.length === 0) return;

      const catDiv = document.createElement('div');
      catDiv.style.cssText = 'margin-bottom: 0.8rem;';
      
      const catLabel = document.createElement('div');
      catLabel.style.cssText = 'font-weight: 600; font-size: 0.85rem; color: #111; margin-bottom: 0.4rem;';
      catLabel.textContent = `${cat.icon} ${cat.label}`;
      catDiv.appendChild(catLabel);
      
      const tagsContainer = document.createElement('div');
      tagsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.4rem;';
      
      tags.slice(0, 5).forEach(tag => {
        const tagBadge = document.createElement('span');
        tagBadge.style.cssText = `
          background: #f3f4f6;
          color: #111;
          padding: 0.3rem 0.6rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
          border: 1px solid #e5e7eb;
        `;
        tagBadge.textContent = `${tag.tag} (${tag.confidence}%)`;
        tagsContainer.appendChild(tagBadge);
      });
      
      catDiv.appendChild(tagsContainer);
      categorySection.appendChild(catDiv);
    });

    resultsEl.appendChild(categorySection);
  }

  // 5. Métricas de Composición
  if (context.composition_metrics) {
    const metricsSection = document.createElement('div');
    metricsSection.style.marginBottom = '1.2rem';
    
    const metricsTitle = document.createElement('h3');
    metricsTitle.style.cssText = 'margin: 0 0 0.8rem 0; font-size: 0.95rem; font-weight: 700; color: #111; border-bottom: 2px solid #06b6d4; padding-bottom: 0.5rem;';
    metricsTitle.textContent = '📊 MÉTRICAS DE COMPOSICIÓN';
    metricsSection.appendChild(metricsTitle);

    const metricsGrid = document.createElement('div');
    metricsGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;';
    
    const metrics = [
      { label: 'Diversidad de Objetos', value: context.composition_metrics.object_diversity, max: 10 },
      { label: 'Diversidad de Colores', value: context.composition_metrics.color_diversity, max: 10 },
      { label: 'Diversidad de Tags', value: context.composition_metrics.tag_diversity, max: 10 }
    ];

    metrics.forEach(m => {
      const metricDiv = document.createElement('div');
      metricDiv.style.cssText = 'background: #f8f9fa; padding: 0.8rem; border-radius: 6px;';
      const percent = (m.value / m.max) * 100;
      metricDiv.innerHTML = `
        <div style="font-weight: 600; font-size: 0.85rem; color: #111; margin-bottom: 0.4rem;">${m.label}</div>
        <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 0.4rem;">
          <div style="background: linear-gradient(90deg, #3b82f6, #10b981); height: 100%; width: ${percent}%;"></div>
        </div>
        <div style="font-size: 0.8rem; color: #6b7280;">${m.value}/10</div>
      `;
      metricsGrid.appendChild(metricDiv);
    });

    metricsSection.appendChild(metricsGrid);
    resultsEl.appendChild(metricsSection);
  }

  // 6. Confianza General
  const confidenceSection = document.createElement('div');
  confidenceSection.style.cssText = `
    padding: 1rem;
    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
    border-left: 4px solid #10b981;
    border-radius: 8px;
    margin-bottom: 1.2rem;
  `;
  
  const confTitle = document.createElement('div');
  confTitle.style.cssText = 'font-weight: 700; font-size: 0.95rem; color: #166534; margin-bottom: 0.6rem;';
  confTitle.textContent = '✅ CONFIANZA GENERAL DEL ANÁLISIS';
  confidenceSection.appendChild(confTitle);
  
  const confValue = document.createElement('div');
  confValue.style.cssText = 'font-size: 2rem; font-weight: 700; color: #22c55e;';
  confValue.textContent = `${parseFloat(context.overall_confidence).toFixed(1)}%`;
  confidenceSection.appendChild(confValue);
  
  resultsEl.appendChild(confidenceSection);
}

function renderSceneContext(context) {
  // Descripción de la escena
  const descSection = document.createElement('div');
  descSection.style.padding = '0.8rem';
  descSection.style.background = '#f0f9ff';
  descSection.style.borderLeft = '4px solid #2b6cb0';
  descSection.style.borderRadius = '6px';
  descSection.style.marginBottom = '1rem';
  
  const descTitle = document.createElement('div');
  descTitle.style.fontWeight = '600';
  descTitle.style.fontSize = '0.9rem';
  descTitle.style.color = '#1e40af';
  descTitle.textContent = '🎬 Análisis de Escena';
  descSection.appendChild(descTitle);
  
  const descText = document.createElement('div');
  descText.style.fontSize = '0.85rem';
  descText.style.color = '#111';
  descText.style.marginTop = '0.4rem';
  descText.textContent = context.scene_description || 'Escena detectada en la imagen';
  descSection.appendChild(descText);
  
  if (context.confidence_score) {
    const confidenceText = document.createElement('div');
    confidenceText.style.fontSize = '0.75rem';
    confidenceText.style.color = '#6b7280';
    confidenceText.style.marginTop = '0.4rem';
    confidenceText.textContent = `Confianza promedio: ${(context.confidence_score * 100).toFixed(1)}%`;
    descSection.appendChild(confidenceText);
  }
  
  resultsEl.appendChild(descSection);

  // Objetos detectados
  if (context.main_objects && context.main_objects.length > 0) {
    const objTitle = document.createElement('h4');
    objTitle.textContent = '🔍 Objetos Principales';
    objTitle.style.marginTop = '1rem';
    objTitle.style.marginBottom = '0.5rem';
    objTitle.style.fontSize = '0.9rem';
    resultsEl.appendChild(objTitle);

    context.main_objects.forEach(obj => {
      const objDiv = document.createElement('div');
      objDiv.style.padding = '0.4rem 0.6rem';
      objDiv.style.background = '#fef3c7';
      objDiv.style.borderRadius = '4px';
      objDiv.style.marginBottom = '0.4rem';
      objDiv.style.fontSize = '0.85rem';
      const confPercent = parseFloat(obj.confidence).toFixed(1);
      objDiv.textContent = `• ${obj.name} (${confPercent}%)`;
      resultsEl.appendChild(objDiv);
    });
  }

  // Colores dominantes
  if (context.dominant_colors && context.dominant_colors.length > 0) {
    const colorTitle = document.createElement('h4');
    colorTitle.textContent = '🎨 Colores Dominantes';
    colorTitle.style.marginTop = '1rem';
    colorTitle.style.marginBottom = '0.5rem';
    colorTitle.style.fontSize = '0.9rem';
    resultsEl.appendChild(colorTitle);

    context.dominant_colors.forEach(color => {
      const colorDiv = document.createElement('div');
      colorDiv.style.display = 'flex';
      colorDiv.style.alignItems = 'center';
      colorDiv.style.gap = '0.5rem';
      colorDiv.style.marginBottom = '0.4rem';
      
      const colorBox = document.createElement('div');
      colorBox.style.width = '24px';
      colorBox.style.height = '24px';
      colorBox.style.backgroundColor = color.hex || '#ccc';
      colorBox.style.borderRadius = '4px';
      colorBox.style.border = '1px solid #e6edf3';
      
      const colorLabel = document.createElement('div');
      colorLabel.style.fontSize = '0.85rem';
      const percentage = color.percentage ? color.percentage.toFixed(1) : '0';
      colorLabel.textContent = `${color.hex || 'N/A'} - ${percentage}%`;
      
      colorDiv.appendChild(colorBox);
      colorDiv.appendChild(colorLabel);
      resultsEl.appendChild(colorDiv);
    });
  }
}

fileForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  clearStatus();
  if (!fileInput.files || !fileInput.files[0]) return showError('Selecciona un archivo');
  const file = fileInput.files[0];
  showPreviewFromFile(file);
  const fd = new FormData();
  fd.append('image', file);
  showStatus('Subiendo y analizando...');
  try {
    const res = await fetch('/api/analyze', { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) { showError('Error: ' + (json.error || JSON.stringify(json))); return; }
    clearStatus();
    renderResponse(json);
  } catch (err) {
    showError('Error de red: ' + err.message);
  }
});

// 🎭 NUEVO: Renderizar resultados de detección de rostros
function renderFaceDetectionResults(json) {
  resultsEl.innerHTML = '';
  
  const facesSection = document.createElement('div');
  facesSection.style.cssText = `
    padding: 1rem;
    background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
    border-left: 4px solid #ec4899;
    border-radius: 8px;
    margin-bottom: 1.2rem;
  `;

  const faceTitle = document.createElement('div');
  faceTitle.style.cssText = 'font-weight: 700; font-size: 1rem; color: #831843; margin-bottom: 0.6rem;';
  faceTitle.textContent = '🎭 DETECCIÓN DE ROSTROS';
  facesSection.appendChild(faceTitle);

  const faces = json.faces || [];
  
  if (faces.length === 0) {
    const noFaces = document.createElement('div');
    noFaces.style.cssText = 'color: #6b7280; font-size: 0.9rem;';
    noFaces.textContent = 'No se detectaron rostros en la imagen.';
    facesSection.appendChild(noFaces);
  } else {
    const faceCount = document.createElement('div');
    faceCount.style.cssText = 'color: #111; font-size: 0.95rem; margin-bottom: 0.8rem; font-weight: 600;';
    faceCount.textContent = `✅ Se detectaron ${faces.length} rostro(s)`;
    facesSection.appendChild(faceCount);

    const facesGrid = document.createElement('div');
    facesGrid.style.cssText = 'display: grid; gap: 0.6rem;';

    faces.slice(0, 10).forEach((face, idx) => {
      const faceDiv = document.createElement('div');
      faceDiv.style.cssText = `
        padding: 0.8rem;
        background: white;
        border-left: 3px solid #ec4899;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;

      const faceInfo = document.createElement('div');
      faceInfo.innerHTML = `
        <div style="font-weight: 600; color: #111;">Rostro ${idx + 1}</div>
        <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.2rem;">ID: ${face.id.substring(0, 16)}...</div>
      `;

      const copyBtn = document.createElement('button');
      copyBtn.style.cssText = `
        padding: 0.4rem 0.8rem;
        background: #ec4899;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.75rem;
        font-weight: 600;
      `;
      copyBtn.textContent = 'Copiar ID';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(face.id);
        copyBtn.textContent = '✓ Copiado';
        setTimeout(() => copyBtn.textContent = 'Copiar ID', 2000);
      };

      faceDiv.appendChild(faceInfo);
      faceDiv.appendChild(copyBtn);
      facesGrid.appendChild(faceDiv);
    });

    facesSection.appendChild(facesGrid);

    // Instrucciones para reconocimiento
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      margin-top: 1rem;
      padding: 0.8rem;
      background: #fef2f2;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #5f2120;
      border-left: 3px solid #dc2626;
    `;
    instructions.innerHTML = `
      <strong>📝 Próximo paso:</strong><br>
      1. Copia el ID de uno de los rostros<br>
      2. Ve a "Reconocer Rostro"<br>
      3. Pega el ID y selecciona un índice<br>
      4. Haz clic en "Reconocer" para identificar
    `;
    facesSection.appendChild(instructions);
  }

  resultsEl.appendChild(facesSection);
}

// 🎭 NUEVO: Reconocer rostro contra índice
async function recognizeFace() {
  const faceIdInput = document.getElementById('faceIdInput');
  const indexIdInput = document.getElementById('indexIdInput');
  const faceId = faceIdInput.value.trim();
  const indexId = indexIdInput.value.trim();

  if (!faceId || !indexId) {
    showError('Por favor rellena Face ID e Index ID');
    return;
  }

  showStatus('Reconociendo rostro...');

  try {
    const res = await fetch(`/api/recognize-face/${indexId}?faceId=${faceId}`);
    const json = await res.json();

    if (!res.ok) {
      showError('Error: ' + (json.error || 'Desconocido'));
      return;
    }

    clearStatus();
    renderRecognitionResults(json);
  } catch (err) {
    showError('Error de red: ' + err.message);
  }
}

// 🎭 NUEVO: Renderizar resultados de reconocimiento
function renderRecognitionResults(json) {
  resultsEl.innerHTML = '';

  const recSection = document.createElement('div');
  recSection.style.cssText = `
    padding: 1rem;
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    border-left: 4px solid #0284c7;
    border-radius: 8px;
    margin-bottom: 1.2rem;
  `;

  const recTitle = document.createElement('div');
  recTitle.style.cssText = 'font-weight: 700; font-size: 1rem; color: #0c4a6e; margin-bottom: 0.6rem;';
  recTitle.textContent = '🔍 RESULTADOS DE RECONOCIMIENTO';
  recSection.appendChild(recTitle);

  const indexInfo = document.createElement('div');
  indexInfo.style.cssText = 'color: #111; font-size: 0.85rem; margin-bottom: 0.8rem;';
  indexInfo.innerHTML = `
    <strong>Índice:</strong> ${json.indexId}<br>
    <strong>Face ID:</strong> ${json.faceId.substring(0, 20)}...
  `;
  recSection.appendChild(indexInfo);

  const topMatch = json.topMatch;
  if (topMatch && topMatch.isMatch) {
    const matchDiv = document.createElement('div');
    matchDiv.style.cssText = `
      padding: 0.8rem;
      background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
      border-left: 3px solid #22c55e;
      border-radius: 6px;
      margin-bottom: 1rem;
    `;
    matchDiv.innerHTML = `
      <div style="font-weight: 700; color: #166534; font-size: 0.95rem;">✅ ¡COINCIDENCIA ENCONTRADA!</div>
      <div style="color: #111; font-size: 1.1rem; font-weight: 700; margin-top: 0.4rem;">${topMatch.personId}</div>
      <div style="color: #6b7280; font-size: 0.85rem; margin-top: 0.2rem;">Confianza: <strong>${topMatch.confidence}%</strong></div>
    `;
    recSection.appendChild(matchDiv);
  } else if (topMatch) {
    const noMatchDiv = document.createElement('div');
    noMatchDiv.style.cssText = `
      padding: 0.8rem;
      background: #fef2f2;
      border-left: 3px solid #dc2626;
      border-radius: 6px;
      margin-bottom: 1rem;
    `;
    noMatchDiv.innerHTML = `
      <div style="font-weight: 700; color: #7f1d1d;">❌ NO SE ENCONTRÓ COINCIDENCIA</div>
      <div style="color: #111; font-size: 0.9rem; margin-top: 0.4rem;">Confianza más alta: ${topMatch.personId} (${topMatch.confidence}%)</div>
    `;
    recSection.appendChild(noMatchDiv);
  }

  // Lista de todos los resultados
  if (json.matches && json.matches.length > 0) {
    const matchesTitle = document.createElement('div');
    matchesTitle.style.cssText = 'font-weight: 600; font-size: 0.9rem; color: #111; margin-top: 0.8rem; margin-bottom: 0.4rem;';
    matchesTitle.textContent = '📊 Todas las coincidencias:';
    recSection.appendChild(matchesTitle);

    const matchesList = document.createElement('div');
    matchesList.style.cssText = 'display: grid; gap: 0.4rem;';

    json.matches.slice(0, 5).forEach(match => {
      const matchItem = document.createElement('div');
      matchItem.style.cssText = `
        padding: 0.5rem 0.7rem;
        background: white;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-left: 3px solid ${match.confidence > 80 ? '#22c55e' : match.confidence > 50 ? '#f59e0b' : '#ef4444'};
      `;
      matchItem.innerHTML = `
        <div style="font-weight: 500; color: #111;">${match.personId}</div>
        <div style="font-weight: 600; color: ${match.confidence > 80 ? '#16a34a' : match.confidence > 50 ? '#d97706' : '#dc2626'};">${match.confidence}% <span style="font-size: 0.7rem; color: #6b7280;">${match.level}</span></div>
      `;
      matchesList.appendChild(matchItem);
    });

    recSection.appendChild(matchesList);
  }

  resultsEl.appendChild(recSection);
}

fileInput.addEventListener('change', () => { if (fileInput.files && fileInput.files[0]) showPreviewFromFile(fileInput.files[0]); });
