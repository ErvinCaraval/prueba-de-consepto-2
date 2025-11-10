const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const path = require('path');
require('dotenv').config();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ storage: multer.memoryStorage() });

const IMAGGA_BASE = process.env.IMAGGA_ENDPOINT || 'https://api.imagga.com';

function getAuthHeader() {
  const key = process.env.IMAGGA_API_KEY;
  const secret = process.env.IMAGGA_API_SECRET;
  if (!key || !secret) throw new Error('Missing IMAGGA_API_KEY/IMAGGA_API_SECRET env vars');
  const token = Buffer.from(`${key}:${secret}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

// Función para obtener análisis completo de la imagen
async function analyzeImageFull(headers, imageIdentifier, isUrl = false) {
  const params = isUrl 
    ? { image_url: imageIdentifier }
    : { image_upload_id: imageIdentifier };

  try {
    // Ejecutar múltiples análisis en paralelo
    const [tagsRes, colorsRes, objectsRes] = await Promise.all([
      axios.get(`${IMAGGA_BASE}/v2/tags`, { headers, params }),
      axios.get(`${IMAGGA_BASE}/v2/colors`, { headers, params }).catch(e => null),
      axios.get(`${IMAGGA_BASE}/v2/auto_tagging`, { headers, params }).catch(e => null)
    ]);

    return {
      tags: tagsRes.data,
      colors: colorsRes?.data || null,
      objects: objectsRes?.data || null
    };
  } catch (err) {
    throw err;
  }
}

// Función para generar análisis contextual avanzado
function generateSceneContext(analysisData) {
  const tags = (analysisData.tags?.result?.tags || []).slice(0, 20);
  const colors = analysisData.colors?.result?.colors || [];
  const objects = analysisData.objects?.result?.tags || [];

  // Clasificar objetos por confianza
  const confidenceThreshold = 0.5;
  const highConfidenceObjects = objects.filter(o => o.confidence >= confidenceThreshold);
  const allObjects = objects.slice(0, 10);

  // Análisis de colores avanzado
  const colorAnalysis = analyzeColorsAdvanced(colors);

  // Análisis de etiquetas por categoría
  const categorizedTags = categorizeTags(tags);

  // Métrica de composición de escena
  const sceneMetrics = calculateSceneMetrics(tags, colors, objects);

  const context = {
    // Objetos detectados (completo y preciso)
    objects_detected: {
      high_confidence: highConfidenceObjects.slice(0, 5).map(o => {
        const confValue = o.confidence || 0;
        const confPercent = confValue > 1 ? confValue : confValue * 100;
        return {
          name: o.tag?.en || 'Unknown',
          confidence: parseFloat(confPercent.toFixed(2)),
          level: getConfidenceLevel(confValue > 1 ? confValue / 100 : confValue)
        };
      }),
      all_objects: allObjects.map(o => {
        const confValue = o.confidence || 0;
        const confPercent = confValue > 1 ? confValue : confValue * 100;
        return {
          name: o.tag?.en || 'Unknown',
          confidence: parseFloat(confPercent.toFixed(2)),
          level: getConfidenceLevel(confValue > 1 ? confValue / 100 : confValue)
        };
      })
    },

    // Análisis de colores detallado
    color_analysis: {
      dominant: colorAnalysis.dominant.slice(0, 5).map(c => ({
        hex: c.hex,
        rgb: c.rgb,
        percentage: parseFloat((c.percentage).toFixed(2)),
        name: colorNameFromHex(c.hex),
        brightness: calculateBrightness(c.hex)
      })),
      palette: colorAnalysis.palette.slice(0, 8),
      color_harmony: analyzeColorHarmony(colors),
      avg_brightness: parseFloat(colorAnalysis.avg_brightness.toFixed(2))
    },

    // Etiquetas categorizadas
    tags_by_category: {
      entities: categorizedTags.entities.slice(0, 8),
      attributes: categorizedTags.attributes.slice(0, 8),
      environment: categorizedTags.environment.slice(0, 8),
      actions: categorizedTags.actions.slice(0, 8),
      concepts: categorizedTags.concepts.slice(0, 8)
    },

    // Descripción inteligente de la escena
    scene_analysis: {
      description: generateDetailedSceneDescription(tags, colors, objects),
      type: detectSceneType(tags, objects),
      setting: detectSetting(tags),
      mood: detectMood(colors, tags),
      dominant_theme: findDominantTheme(tags)
    },

    // Métricas de composición
    composition_metrics: sceneMetrics,

    // Confianza general
    overall_confidence: parseFloat(calculateAverageConfidence(tags).toFixed(2)),
    
    // Tags completos (ordenados por confianza)
    all_tags: tags.slice(0, 20).map(t => {
      const confValue = t.confidence || 0;
      const confPercent = confValue > 1 ? confValue : confValue * 100;
      return {
        tag: t.tag?.en || 'Unknown',
        confidence: parseFloat(confPercent.toFixed(2)),
        level: getConfidenceLevel(confValue > 1 ? confValue / 100 : confValue)
      };
    })
  };

  return context;
}

// Obtener nivel de confianza (ALTO, MEDIO, BAJO)
function getConfidenceLevel(confidence) {
  // Si es 0-100, dividir por 100 primero
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  if (normalized >= 0.8) return 'ALTO';
  if (normalized >= 0.5) return 'MEDIO';
  return 'BAJO';
}

// Análisis avanzado de colores
function analyzeColorsAdvanced(colors) {
  if (!colors || colors.length === 0) {
    return { dominant: [], palette: [], avg_brightness: 50 };
  }

  const sorted = [...colors].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
  const brightness = colors.map(c => calculateBrightness(c.hex)).filter(b => b !== null);
  const avgBrightness = brightness.length > 0 ? brightness.reduce((a, b) => a + b) / brightness.length : 50;

  return {
    dominant: sorted.slice(0, 5).map(c => ({
      hex: c.hex,
      rgb: hexToRgb(c.hex),
      percentage: c.percentage || 0
    })),
    palette: sorted.map(c => c.hex),
    avg_brightness: avgBrightness
  };
}

// Convertir hex a RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

// Calcular brillo (0-100)
function calculateBrightness(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 50;
  return Math.round((rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000);
}

// Nombre del color
function colorNameFromHex(hex) {
  const colorNames = {
    '#000000': 'Negro', '#FFFFFF': 'Blanco', '#FF0000': 'Rojo', '#00FF00': 'Verde',
    '#0000FF': 'Azul', '#FFFF00': 'Amarillo', '#FF00FF': 'Magenta', '#00FFFF': 'Cyan',
    '#808080': 'Gris', '#FFA500': 'Naranja', '#800080': 'Púrpura', '#FFC0CB': 'Rosa'
  };
  
  // Buscar el más cercano
  let closestColor = 'Desconocido';
  let minDistance = Infinity;
  const rgb = hexToRgb(hex);
  
  if (!rgb) return 'Desconocido';
  
  for (const [hex, name] of Object.entries(colorNames)) {
    const refRgb = hexToRgb(hex);
    const distance = Math.sqrt(
      Math.pow(rgb.r - refRgb.r, 2) +
      Math.pow(rgb.g - refRgb.g, 2) +
      Math.pow(rgb.b - refRgb.b, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = name;
    }
  }
  
  return closestColor;
}

// Analizar armonía de colores
function analyzeColorHarmony(colors) {
  if (!colors || colors.length < 2) return 'Insuficientes datos';
  
  const dominant = colors.slice(0, 2);
  const hex1 = dominant[0]?.hex;
  const hex2 = dominant[1]?.hex;
  
  if (!hex1 || !hex2) return 'Insuficientes datos';
  
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  if (!rgb1 || !rgb2) return 'Insuficientes datos';
  
  const diff = Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
  
  if (diff > 200) return 'Contrastado';
  if (diff > 100) return 'Complementario';
  return 'Análogo';
}

// Categorizar etiquetas
function categorizeTags(tags) {
  const keywords = {
    entities: ['person', 'people', 'man', 'woman', 'child', 'animal', 'dog', 'cat', 'bird', 'car', 'building', 'tree', 'flower', 'plant'],
    attributes: ['beautiful', 'dark', 'bright', 'color', 'colorful', 'monochrome', 'small', 'large', 'old', 'new'],
    environment: ['outdoor', 'indoor', 'nature', 'mountain', 'sea', 'beach', 'forest', 'city', 'street', 'sky', 'water', 'ground'],
    actions: ['running', 'walking', 'sitting', 'standing', 'playing', 'sleeping', 'eating', 'jumping', 'flying', 'swimming'],
    concepts: ['love', 'happy', 'sad', 'beautiful', 'ugly', 'fun', 'serious', 'calm', 'exciting', 'peaceful']
  };

  const categorized = {
    entities: [],
    attributes: [],
    environment: [],
    actions: [],
    concepts: []
  };

  tags.forEach(t => {
    const tagName = (t.tag?.en || 'Unknown').toLowerCase();
    const confidenceValue = t.confidence || 0;
    // Convertir a porcentaje (0-100) si viene como decimal (0-1)
    const confidencePercent = confidenceValue > 1 ? confidenceValue : confidenceValue * 100;
    const item = {
      tag: t.tag?.en || 'Unknown',
      confidence: parseFloat(confidencePercent.toFixed(2)),
      level: getConfidenceLevel(confidenceValue > 1 ? confidenceValue / 100 : confidenceValue)
    };

    for (const [category, keywords_list] of Object.entries(keywords)) {
      if (keywords_list.some(kw => tagName.includes(kw))) {
        categorized[category].push(item);
        return;
      }
    }
    categorized.concepts.push(item);
  });

  return categorized;
}

// Detectar tipo de escena
function detectSceneType(tags, objects) {
  const tagNames = tags.map(t => (t.tag?.en || 'Unknown').toLowerCase()).join(' ');
  
  if (tagNames.includes('portrait') || tagNames.includes('person')) return 'Retrato';
  if (tagNames.includes('landscape') || tagNames.includes('mountain')) return 'Paisaje';
  if (tagNames.includes('food') || tagNames.includes('drink')) return 'Comida';
  if (tagNames.includes('animal')) return 'Vida Silvestre';
  if (tagNames.includes('building') || tagNames.includes('architecture')) return 'Arquitectura';
  if (tagNames.includes('nature') || tagNames.includes('outdoor')) return 'Naturaleza';
  return 'General';
}

// Detectar ambiente
function detectSetting(tags) {
  const tagNames = tags.map(t => (t.tag?.en || 'Unknown').toLowerCase()).join(' ');
  
  if (tagNames.includes('indoor')) return 'Interior';
  if (tagNames.includes('outdoor') || tagNames.includes('sky')) return 'Exterior';
  if (tagNames.includes('night')) return 'Noche';
  if (tagNames.includes('day')) return 'Día';
  return 'No especificado';
}

// Detectar mood (estado de ánimo)
function detectMood(colors, tags) {
  const tagNames = tags.map(t => (t.tag?.en || 'Unknown').toLowerCase()).join(' ');
  const brightness = colors.length > 0 
    ? colors.slice(0, 3).map(c => calculateBrightness(c.hex)).reduce((a, b) => a + b) / 3
    : 50;

  if (brightness > 70) {
    return 'Alegre y Luminoso';
  } else if (brightness < 30) {
    return 'Oscuro y Misterioso';
  } else if (tagNames.includes('nature') || tagNames.includes('calm')) {
    return 'Tranquilo y Sereno';
  } else if (tagNames.includes('action') || tagNames.includes('sport')) {
    return 'Dinámico y Energético';
  }
  return 'Neutral';
}

// Encontrar tema dominante
function findDominantTheme(tags) {
  if (tags.length === 0) return 'Desconocido';
  return tags[0]?.tag?.en || 'Desconocido';
}

// Generar descripción detallada
function generateDetailedSceneDescription(tags, colors, objects) {
  const topTags = tags.slice(0, 6).map(t => t.tag?.en || 'Unknown');
  const topColors = colors.slice(0, 3).map(c => colorNameFromHex(c.hex));
  const topObjects = objects.slice(0, 3).map(o => o.tag?.en || 'Unknown');

  let description = `Imagen que contiene: ${topTags.join(', ')}. `;
  if (topObjects.length > 0) {
    description += `Objetos principales: ${topObjects.join(', ')}. `;
  }
  if (topColors.length > 0) {
    description += `Tonalidades: ${topColors.join(', ')}.`;
  }
  return description;
}

// Calcular métricas de composición
function calculateSceneMetrics(tags, colors, objects) {
  return {
    object_diversity: Math.min(objects.length, 10),
    color_diversity: Math.min(colors.length, 10),
    tag_diversity: Math.min(tags.length, 10),
    complexity: calculateComplexity(tags, colors, objects),
    vibrancy: calculateVibrancy(colors)
  };
}

// Calcular complejidad
function calculateComplexity(tags, colors, objects) {
  const score = (tags.length * 0.4 + objects.length * 0.3 + colors.length * 0.3) / 2;
  if (score > 7) return 'Muy Alta';
  if (score > 5) return 'Alta';
  if (score > 3) return 'Media';
  return 'Baja';
}

// Calcular vibración de colores
function calculateVibrancy(colors) {
  if (!colors || colors.length === 0) return 'Baja';
  const saturations = colors.map(c => {
    const rgb = hexToRgb(c.hex);
    if (!rgb) return 0;
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    return max === 0 ? 0 : (max - min) / max;
  });
  const avgSaturation = saturations.reduce((a, b) => a + b) / saturations.length;
  
  if (avgSaturation > 0.5) return 'Muy Alta';
  if (avgSaturation > 0.3) return 'Alta';
  if (avgSaturation > 0.1) return 'Media';
  return 'Baja';
}

// Calcular confianza promedio
function calculateAverageConfidence(tags) {
  if (!tags || tags.length === 0) return 0;
  
  // Detectar si los valores son 0-1 o 0-100
  const firstConfidence = tags[0]?.confidence || 0;
  const isDecimal = firstConfidence <= 1;
  
  const sum = tags.reduce((acc, t) => {
    const conf = t.confidence || 0;
    // Si es decimal (0-1), multiplicar por 100; si no, usar tal cual
    return acc + (isDecimal ? conf * 100 : conf);
  }, 0);
  
  const avg = sum / tags.length;
  return Math.min(100, Math.max(0, avg));
}

// 🎭 NUEVO: Detección de Rostros
app.post('/api/detect-faces', upload.single('image'), async (req, res) => {
  try {
    const headers = getAuthHeader();

    // Detectar rostros desde URL
    if (req.body.image_url) {
      const imageUrl = req.body.image_url;
      try {
        const facesRes = await axios.get(`${IMAGGA_BASE}/v2/faces/detection`, {
          headers,
          params: {
            image_url: imageUrl,
            return_face_id: 1
          }
        });
        return res.json({ 
          source: 'url', 
          faces: facesRes.data?.result?.faces || [],
          raw: facesRes.data 
        });
      } catch (err) {
        return res.status(400).json({ error: 'No faces detected in URL image' });
      }
    }

    // Detectar rostros desde archivo subido
    if (req.file) {
      const form = new FormData();
      form.append('image', req.file.buffer, {
        filename: req.file.originalname || 'upload.jpg'
      });

      const uploadRes = await axios.post(`${IMAGGA_BASE}/v2/uploads`, form, {
        headers: { ...form.getHeaders(), ...headers },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const uploadId = uploadRes.data?.result?.upload_id;
      if (!uploadId) throw new Error('No upload_id returned from Imagga');

      try {
        const facesRes = await axios.get(`${IMAGGA_BASE}/v2/faces/detection`, {
          headers,
          params: {
            image_upload_id: uploadId,
            return_face_id: 1
          }
        });
        return res.json({ 
          source: 'upload', 
          faces: facesRes.data?.result?.faces || [],
          raw: facesRes.data 
        });
      } catch (err) {
        return res.status(400).json({ error: 'No faces detected in uploaded image' });
      }
    }

    res.status(400).json({ error: 'Provide image_url or upload an image file (form field: image)' });
  } catch (err) {
    console.error('Face detection error:', err.message);
    res.status(500).json({ 
      error: 'Face detection failed', 
      message: err.message 
    });
  }
});

// 🎭 NUEVO: Crear Índice de Reconocimiento
app.put('/api/create-index', async (req, res) => {
  try {
    const { indexId, people } = req.body;
    
    if (!indexId || !people) {
      return res.status(400).json({ 
        error: 'Missing indexId or people data',
        example: {
          indexId: "my_celebrities",
          people: {
            "person_name": ["face_id_1", "face_id_2"],
            "another_person": ["face_id_3", "face_id_4"]
          }
        }
      });
    }

    const headers = getAuthHeader();

    const response = await axios.put(
      `${IMAGGA_BASE}/v2/faces/recognition/${indexId}`,
      { people },
      { headers }
    );

    res.json({
      success: true,
      indexId,
      result: response.data?.result,
      message: `Index "${indexId}" created/updated successfully`
    });
  } catch (err) {
    console.error('Index creation error:', err.response?.data || err.message);
    res.status(500).json({ 
      error: 'Index creation failed',
      details: err.response?.data || err.message
    });
  }
});

// 🎭 NUEVO: Reconocer Rostro contra Índice
app.get('/api/recognize-face/:indexId', async (req, res) => {
  try {
    const { indexId } = req.params;
    const { faceId } = req.query;

    if (!faceId) {
      return res.status(400).json({ 
        error: 'Missing faceId parameter',
        usage: '/api/recognize-face/my_index?faceId=<face_id_from_detection>'
      });
    }

    const headers = getAuthHeader();

    const response = await axios.get(
      `${IMAGGA_BASE}/v2/faces/recognition/${indexId}`,
      {
        headers,
        params: { face_id: faceId }
      }
    );

    const people = response.data?.result?.people || [];
    
    res.json({
      success: true,
      indexId,
      faceId,
      matches: people.map(p => ({
        personId: p.id,
        confidence: parseFloat((p.score).toFixed(2)),
        level: p.score > 80 ? 'ALTO' : p.score > 50 ? 'MEDIO' : 'BAJO'
      })),
      topMatch: people.length > 0 ? {
        personId: people[0].id,
        confidence: parseFloat((people[0].score).toFixed(2)),
        isMatch: people[0].score > 80
      } : null,
      raw: response.data
    });
  } catch (err) {
    console.error('Face recognition error:', err.response?.data || err.message);
    res.status(500).json({ 
      error: 'Face recognition failed',
      details: err.response?.data || err.message
    });
  }
});

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    const headers = getAuthHeader();

    if (req.body.image_url) {
      const imageUrl = req.body.image_url;
      const analysis = await analyzeImageFull(headers, imageUrl, true);
      const context = generateSceneContext(analysis);
      return res.json({ source: 'url', data: analysis, context });
    }

    if (req.file) {
      // Upload binary image to Imagga uploads endpoint
      const form = new FormData();
      form.append('image', req.file.buffer, {
        filename: req.file.originalname || 'upload.jpg'
      });

      const uploadRes = await axios.post(`${IMAGGA_BASE}/v2/uploads`, form, {
        headers: { ...form.getHeaders(), ...headers },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const uploadId = uploadRes.data?.result?.upload_id;
      if (!uploadId) throw new Error('No upload_id returned from Imagga');
      
      // Realizar análisis completo con reintentos
      let analysis;
      try {
        analysis = await analyzeImageFull(headers, uploadId, false);
      } catch (err) {
        const status = err?.response?.status;
        if (status && status >= 500 && status < 600) {
          console.warn('Analysis endpoint returned server error, retrying once...', status);
          analysis = await analyzeImageFull(headers, uploadId, false);
        } else {
          throw err;
        }
      }

      const context = generateSceneContext(analysis);
      return res.json({ source: 'upload', data: analysis, context });
    }

    res.status(400).json({ error: 'Provide image_url or upload an image file (form field: image)' });
  } catch (err) {
    // Enhanced error logging for easier debugging
    if (err && err.response) {
      console.error('Imagga API error: status=', err.response.status);
      try { console.error('Imagga response body:', JSON.stringify(err.response.data)); } catch(e) { console.error(err.response.data); }
      console.error('Imagga response headers:', err.response.headers);
    } else {
      console.error('Error:', err && err.message ? err.message : err);
    }

    // Provide a clearer error message to the client while not exposing sensitive internals
    const clientMessage = (err && err.response && err.response.data && err.response.data.status && err.response.data.status.text)
      ? err.response.data.status.text
      : 'Unexpected error while analyzing the image.';

    res.status(500).json({ error: 'Analysis failed', message: clientMessage, details: err?.response?.data || err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
