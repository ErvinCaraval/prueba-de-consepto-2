# VisionMate — Analizador local de imágenes

Este repositorio contiene una aplicación web de análisis de imágenes diseñada para:

- Extraer etiquetas y conceptos desde una imagen.
- Detectar objetos y elementos relevantes en la escena.
- Analizar paletas de color dominantes y métricas visuales (brillo, vibrancia, armonía cromática).
- Detectar rostros y producir identificadores únicos (Face IDs) para su uso en flujos de reconocimiento.

La aplicación actúa como orquestador: acepta imágenes (subidas desde archivo), envía la imagen a un servicio de análisis externo y procesa la respuesta para presentar un informe rico en metadatos y métricas.

Nota: por diseño la aplicación delega la inferencia (modelos de visión) a un servicio de análisis de imágenes; este README no menciona el nombre del proveedor del servicio externo.

---

## Qué hace esta aplicación

- Interfaz web (front-end) que permite subir una imagen desde tu equipo y ver una vista previa.
- Endpoints en el servidor (back-end) para recibir la imagen, enviarla al servicio de análisis y devolver los resultados procesados al cliente.
- Post-procesado de los resultados recibidos: normalización de confidencias, cálculo de métricas de escena, extracción de paleta de colores y preparación de datos para visualización.
- Funcionalidad de detección de rostros que devuelve posiciones y Face IDs por cada rostro detectado.

---

## Archivos principales

- `server.js` — Servidor Express que expone los endpoints para subir imágenes y obtener análisis.
- `public/index.html` — Interfaz del usuario.
- `public/app.js` — Lógica del frontend: subir imágenes, mostrar vista previa y renderizar resultados.
- Otros archivos de utilidad y documentación breve en el proyecto.

---

## Endpoints relevantes

- `POST /api/analyze` — Recibe una imagen (form-data) y devuelve un análisis completo (etiquetas, colores, objetos, contexto).
- `POST /api/detect-faces` — Detecta rostros en la imagen y devuelve una lista de rostros con `id`, `x`, `y`, `width`, `height`.
- `PUT /api/create-index` — Crea o actualiza un índice de reconocimiento a partir de Face IDs (interno).
- `GET /api/recognize-face/:indexId` — Reconoce un Face ID dentro de un índice y devuelve coincidencias.

> Observación: la aplicación ya contiene implementaciones para estos endpoints en `server.js`.

---



---

## Cómo ejecutar localmente

1. Instalar dependencias:

```bash
npm install
```


```

3. Iniciar la aplicación:

```bash
node server.js
```

4. Abrir en el navegador:

```
http://localhost:3000
```

---

## Notas sobre privacidad y uso

- Si trabajas con datos sensibles o rostros, asegúrate de tener el consentimiento adecuado y cumplir la normativa aplicable (por ejemplo GDPR/CCPA u otras leyes locales).
- La aplicación envía imágenes a un servicio externo para procesarlas; revisa la política de privacidad y términos del servicio que se utilice antes de operar con datos personales.

---

## Extensiones y próximos pasos sugeridos

- Implementar detección y/o reconocimiento local (sin depender de un servicio externo) usando bibliotecas de visión por computador si se requiere mayor control o privacidad.
- Añadir persistencia (base de datos) para guardar índices y Face IDs.
- Mejorar la interfaz para procesar lotes de imágenes.

---

Si quieres que adapte el README (por ejemplo, añadir ejemplos concretos de uso, capturas o comandos curl), dime y lo actualizo.
- Tema dominante

### 2. Objetos Detectados 🔍
- Hasta 10 objetos identificados
- Niveles de confianza: ALTO (>80%), MEDIO, BAJO
- Porcentaje individual para cada objeto

### 3. Análisis de Colores ��
- 5 colores dominantes con:
  - Código HEX exacto
  - Valores RGB completos
  - Porcentaje de ocupación
  - Nombre descriptivo
  - Brillo (0-100)
- Armonía: Contrastado, Complementario, Análogo
- Brillo promedio y vibración

### 4. Etiquetas Categorizadas 📂
- 👥 Entidades (personas, animales, objetos)
- 🌍 Ambiente (lugares, naturaleza, ciudad)
- ✨ Atributos (cualidades visuales)
- ⚡ Acciones (movimientos, actividades)
- 💡 Conceptos (ideas abstractas)

### 5. Métricas de Composición 📊
- Diversidad de objetos (0-10)
- Diversidad de colores (0-10)
- Diversidad de tags (0-10)
- Complejidad visual (Baja/Media/Alta/Muy Alta)
- Vibración general

### 6. Confianza General ✅
- Porcentaje de certeza del análisis completo
- Rango: 0-100%

## 📈 Mejoras vs v1.0

| Característica | Antes | Ahora |
|---|---|---|
| Tags mostrados | 10 | 20 |
| Objetos detectados | 5 | 10 |
| Info de colores | Básica | HEX, RGB, Brillo |
| Categorización | ❌ | ✅ 5 categorías |
| Armonía de colores | ❌ | ✅ |
| Análisis de mood | ❌ | ✅ |
| Métricas composición | ❌ | ✅ |
| Niveles confianza | ❌ | ✅ |

## Setup Rápido

1. Copia `.env.example` a `.env` y rellena tus credenciales de Imagga

2. Instala dependencias:
```bash
npm install
```

3. Arranca el servidor:
```bash
npm start
```

4. Abre en navegador:
```
http://localhost:3000
```

## 🔐 Seguridad
- No comitas tus claves en repositorios públicos
- Usa `.env` local (ya está en `.gitignore`)
- Si compartiste claves, rotealas en Imagga

## 🎯 Casos de Uso
✅ Catalogación profesional de imágenes
✅ Análisis de paletas de color
✅ Validación automática de contenido
✅ Búsqueda visual avanzada
✅ Análisis artístico de composición
✅ Control de calidad de imágenes


## 🚀 ¡Listo para usar!
Tu análisis es ahora **ultra preciso**. Pruébalo con diferentes imágenes.
