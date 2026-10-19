// Export at twice the SVG's viewBox size, independently of the preview zoom.
export function pngSize(svg) {
  const match = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/);
  const values = match?.[1].trim().split(/[\s,]+/).map(Number);
  if (!values || values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
    throw new Error('SVG 缺少有效的画布尺寸');
  }
  const [, , width, height] = values;
  // Bound memory use for large diagrams (16 million pixels / 8192 per side).
  const scale = Math.min(2, 8192 / width, 8192 / height, Math.sqrt(16000000 / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
}
export async function svgToPng(svg) {
  const { width, height } = pngSize(svg);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('PNG 导出时无法加载图表'));
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建 PNG 画布');
    context.drawImage(image, 0, 0, width, height);
    const data = canvas.toDataURL('image/png');
    if (!data.startsWith('data:image/png;base64,')) throw new Error('无法编码 PNG 图像');
    return { blob: data.slice(data.indexOf(',') + 1), width, height };
  } finally { canvas.width = canvas.height = 0; }
}
